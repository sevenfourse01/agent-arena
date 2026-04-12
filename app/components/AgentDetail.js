'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COIN_OPTIONS = ['BTC','ETH','SOL','BNB','DOGE','ADA','XRP','AVAX','MATIC','LINK','DOT','SHIB','PEPE','WIF','BONK']
const SCAN_INTERVAL_MS = 60000

function formatPrice(n) {
  if (!n) return '$0.00'
  if (n < 0.01) return '$' + n.toFixed(6)
  if (n < 1)    return '$' + n.toFixed(4)
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function AgentDetail({ agentId, userId, onBack }) {
  const [agent, setAgent]           = useState(null)
  const [trades, setTrades]         = useState([])
  const [polyBets, setPolyBets]     = useState([])
  const [polyMarkets, setPolyMarkets] = useState([])
  const [isRunning, setIsRunning]   = useState(false)
  const [countdown, setCountdown]   = useState(0)
  const [log, setLog]               = useState([])
  const [loading, setLoading]       = useState(true)
  const [showTrades, setShowTrades] = useState(false)
  const [showBets, setShowBets]     = useState(false)
  const [editingCoins, setEditingCoins] = useState(false)
  const [selectedCoins, setSelectedCoins] = useState([])
  const [customCA, setCustomCA]     = useState('')
  const [customCAs, setCustomCAs]   = useState([])
  const [saving, setSaving]         = useState(false)
  const [prompt_, setPrompt]        = useState('')
  const [asking, setAsking]         = useState(false)

  const intervalRef   = useRef(null)
  const countdownRef  = useRef(null)

  const loadAgent = useCallback(async () => {
    const { data } = await supabase.from('agents').select('*').eq('id', agentId).single()
    if (data) {
      setAgent(data)
      setSelectedCoins(Array.isArray(data.coins) ? data.coins : [])
      setCustomCAs(Array.isArray(data.custom_coin_cas) ? data.custom_coin_cas : [])
    }
    setLoading(false)
  }, [agentId])

  const loadTrades = useCallback(async () => {
    const { data } = await supabase
      .from('trades').select('*').eq('agent_id', agentId)
      .order('created_at', { ascending: false }).limit(50)
    setTrades(data || [])
  }, [agentId])

  const loadPolyBets = useCallback(async () => {
    try {
      const res  = await fetch(`/api/polymarket?type=bets&agentId=${agentId}`)
      const data = await res.json()
      setPolyBets(data.bets || [])
    } catch {}
  }, [agentId])

  const loadPolyMarkets = useCallback(async () => {
    try {
      const res  = await fetch('/api/polymarket?type=markets')
      const data = await res.json()
      setPolyMarkets(data.markets || [])
    } catch {}
  }, [])

  useEffect(() => {
    loadAgent(); loadTrades(); loadPolyBets(); loadPolyMarkets()
  }, [loadAgent, loadTrades, loadPolyBets, loadPolyMarkets])

  const addLogEntry = useCallback((action, coin, price, reasoning) => {
    const colorMap = { BUY: 'green', SELL: 'red', CLOSE: 'orange', HOLD: 'blue', BET: 'purple', INFO: 'gray' }
    setLog(prev => [{
      label: action,
      color: colorMap[action] || 'blue',
      msg: coin ? `${action} ${coin} @ ${formatPrice(price)}` : reasoning?.slice(0, 60) || action,
      reason: reasoning || '',
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }, ...prev.slice(0, 29)])
  }, [])

  const runScan = useCallback(async () => {
    if (!agent) return
    addLogEntry('INFO', null, null, `Scanning ${(Array.isArray(agent.coins) ? agent.coins : []).length} coins + Polymarket...`)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId, userId,
          coins: Array.isArray(agent.coins) ? agent.coins : [],
          riskSettings: agent.risk_settings || {},
          behaviorSettings: agent.behavior_settings || {},
          customCoinCAs: Array.isArray(agent.custom_coin_cas) ? agent.custom_coin_cas : [],
          cachedPrices: {},
        }),
      })
      const result = await res.json()
      if (result.success) {
        await loadAgent(); await loadTrades(); await loadPolyBets()
        ;(result.trades || []).forEach(t => addLogEntry(t.action, t.coin, t.price, t.reasoning || ''))
        if (result.polymarket) {
          const b = result.polymarket
          addLogEntry('BET', null, null, `Bet $${b.stake} on "${b.market?.slice(0,50)}..." → ${b.outcome}`)
        }
        if (result.fearGreed) {
          addLogEntry('INFO', null, null, `Fear & Greed: ${result.fearGreed.value} (${result.fearGreed.value_classification})`)
        }
      }
    } catch (err) {
      addLogEntry('INFO', null, null, `ERROR: ${err.message}`)
    }
  }, [agent, agentId, userId, loadAgent, loadTrades, loadPolyBets, addLogEntry])

  const startTrading = useCallback(() => {
    setIsRunning(true)
    runScan()
    setCountdown(SCAN_INTERVAL_MS / 1000)
    intervalRef.current  = setInterval(() => { runScan(); setCountdown(SCAN_INTERVAL_MS / 1000) }, SCAN_INTERVAL_MS)
    countdownRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
  }, [runScan])

  const stopTrading = useCallback(async () => {
    setIsRunning(false)
    clearInterval(intervalRef.current); clearInterval(countdownRef.current)
    await supabase.from('agents').update({ status: 'paused' }).eq('id', agentId)
    await loadAgent()
  }, [agentId, loadAgent])

  useEffect(() => () => { clearInterval(intervalRef.current); clearInterval(countdownRef.current) }, [])

  const saveCoins = async () => {
    setSaving(true)
    await supabase.from('agents').update({ coins: selectedCoins, custom_coin_cas: customCAs }).eq('id', agentId)
    await loadAgent(); setEditingCoins(false); setSaving(false)
  }

  const addCustomCA = () => {
    const t = customCA.trim()
    if (t && !customCAs.includes(t)) { setCustomCAs(p => [...p, t]); setCustomCA('') }
  }

  const toggleForum = async (key) => {
    const current = agent?.forum_settings || {}
    const updated = { ...current, [key]: !current[key] }
    await supabase.from('agents').update({ forum_settings: updated }).eq('id', agentId)
    setAgent(p => ({ ...p, forum_settings: updated }))
  }

  const sendManualPrompt = async () => {
    if (!prompt_.trim()) return
    setAsking(true)
    addLogEntry('INFO', null, null, `You asked: ${prompt_}`)
    try {
      const res  = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt_, agent }),
      })
      const data = await res.json()
      addLogEntry('INFO', null, null, data.response || 'No response')
    } catch {}
    setPrompt(''); setAsking(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-gray-400 text-sm animate-pulse">Loading agent...</div>
    </div>
  )
  if (!agent) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-red-500 text-sm">Agent not found.</div>
    </div>
  )

  const cash        = typeof agent.cash_balance    === 'number' ? agent.cash_balance    : 10000
  const invested    = typeof agent.invested_value  === 'number' ? agent.invested_value  : 0
  const poly        = typeof agent.polymarket_balance === 'number' ? agent.polymarket_balance : 0
  const total       = typeof agent.portfolio_value === 'number' ? agent.portfolio_value : 10000
  const totalReturn = typeof agent.total_return    === 'number' ? agent.total_return    : 0
  const winRate     = agent.win_rate ?? 0

  const cashPct     = total > 0 ? (cash     / total) * 100 : 100
  const investedPct = total > 0 ? (invested / total) * 100 : 0
  const polyPct     = total > 0 ? (poly     / total) * 100 : 0

  const agentCoins  = Array.isArray(agent.coins)           ? agent.coins           : []
  const agentCAs    = Array.isArray(agent.custom_coin_cas) ? agent.custom_coin_cas : []
  const forums      = agent.forum_settings || {}

  const openTrades    = trades.filter(t => t.status === 'open')
  const closedTrades  = trades.filter(t => t.status === 'closed')
  const openBets      = polyBets.filter(b => b.status === 'open')
  const resolvedBets  = polyBets.filter(b => b.status === 'resolved')
  const polyWins      = resolvedBets.filter(b => b.result === 'win').length
  const polyWinRate   = resolvedBets.length > 0 ? ((polyWins / resolvedBets.length) * 100).toFixed(0) : '—'

  const typeColors = {
    green:  'bg-emerald-50 text-emerald-700',
    red:    'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    blue:   'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-700',
    gray:   'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-700 text-sm transition">← Back</button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
            {agent.name?.slice(0,2)?.toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">{agent.name}</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}/>
              {isRunning ? `Scanning in ${countdown}s` : 'Paused'}
            </div>
          </div>
        </div>
        <button
          onClick={isRunning ? stopTrading : startTrading}
          className={`px-5 py-2 rounded-xl font-semibold text-sm transition ${
            isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          {isRunning ? '⏸ Pause' : '▶ Start'}
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Portfolio',     value: formatPrice(total),                          color: 'text-gray-900' },
          { label: 'Return',        value: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`, color: totalReturn >= 0 ? 'text-emerald-600' : 'text-red-500' },
          { label: 'Win rate',      value: `${winRate}%`,                               color: 'text-blue-600' },
          { label: 'Poly win rate', value: polyWinRate === '—' ? '—' : `${polyWinRate}%`, color: 'text-purple-600' },
          { label: 'Open trades',   value: openTrades.length,                           color: 'text-gray-900' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Portfolio Allocation ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-900 mb-3">Portfolio allocation</div>
        <div className="h-2.5 rounded-full overflow-hidden flex mb-3 bg-gray-100">
          {cashPct > 0     && <div className="bg-blue-400 h-full transition-all"    style={{ width: `${cashPct}%` }}/>}
          {investedPct > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${investedPct}%` }}/>}
          {polyPct > 0     && <div className="bg-purple-500 h-full transition-all"  style={{ width: `${polyPct}%` }}/>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            { label: 'Cash',        value: cash,     pct: cashPct,     dot: 'bg-blue-400'    },
            { label: 'Crypto',      value: invested, pct: investedPct, dot: 'bg-emerald-500' },
            { label: 'Polymarket',  value: poly,     pct: polyPct,     dot: 'bg-purple-500'  },
          ].map(({ label, value, pct, dot }) => (
            <div key={label}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className={`w-2 h-2 rounded-full ${dot}`}/>
                <span className="text-gray-500">{label}</span>
              </div>
              <div className="font-semibold text-gray-900">{formatPrice(value)}</div>
              <div className="text-gray-400">{pct.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── Left Column ── */}
        <div className="md:col-span-2 space-y-4">

          {/* Open Positions */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Open positions ({openTrades.length})</div>
            {openTrades.length === 0 ? (
              <div className="text-xs text-gray-400 py-2">No open positions</div>
            ) : (
              <div className="space-y-2">
                {openTrades.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">LONG</span>
                      <span className="text-sm font-semibold text-gray-900">{t.coin}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Entry {formatPrice(t.entry_price)}</div>
                      <div className="text-xs text-gray-400">{formatPrice(t.amount)} at risk</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thought Log */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Agent thought log</span>
              <div className="flex items-center gap-2">
                {isRunning && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>}
                <span className="text-xs text-gray-400">{isRunning ? 'scanning every 60s' : 'idle'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-0 max-h-64 overflow-y-auto">
              {log.length === 0 ? (
                <div className="text-xs text-gray-400 py-4 text-center">Hit Start to begin scanning</div>
              ) : log.map((entry, i) => (
                <div key={i} className="py-2.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[entry.color] || typeColors.blue}`}>{entry.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{entry.time}</span>
                  </div>
                  <p className="text-xs text-gray-800 mb-1">{entry.msg}</p>
                  {entry.reason && <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 leading-relaxed">{entry.reason}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <input
                value={prompt_} onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendManualPrompt()}
                placeholder="Ask your agent anything..."
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400 text-gray-900 placeholder-gray-400"
              />
              <button onClick={sendManualPrompt} disabled={asking}
                className="bg-emerald-500 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50">
                {asking ? '...' : 'Ask'}
              </button>
            </div>
          </div>

          {/* Trade History — collapsible */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <button onClick={() => setShowTrades(!showTrades)} className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-gray-900">Trade history ({closedTrades.length} closed)</span>
              <span className="text-xs text-gray-400">{showTrades ? '▲ Hide' : '▼ Show'}</span>
            </button>
            {showTrades && (
              <div className="mt-3 overflow-x-auto max-h-80 overflow-y-auto">
                {closedTrades.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">No closed trades yet</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Time','Coin','Type','Entry','Exit','P&L'].map(h => (
                          <th key={h} className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {closedTrades.map((t, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-3 text-xs text-gray-400 whitespace-nowrap">
                            {new Date(t.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                          </td>
                          <td className="py-2 pr-3 text-xs font-semibold text-gray-900">{t.coin}</td>
                          <td className="py-2 pr-3">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.type==='buy'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>
                              {t.type?.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-xs text-gray-700 font-mono">{formatPrice(t.entry_price)}</td>
                          <td className="py-2 pr-3 text-xs text-gray-700 font-mono">{t.exit_price ? formatPrice(t.exit_price) : '—'}</td>
                          <td className="py-2 pr-3 text-xs font-semibold">
                            {t.pnl != null
                              ? <span className={t.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>{t.pnl >= 0 ? '+' : ''}{formatPrice(t.pnl)}</span>
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">

          {/* Coins Watched */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-900">Coins watched</div>
              <button onClick={() => setEditingCoins(!editingCoins)} className="text-xs text-blue-500 hover:text-blue-700">
                {editingCoins ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {!editingCoins ? (
              <div className="flex flex-wrap gap-1.5">
                {agentCoins.map(c => (
                  <span key={c} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">{c}</span>
                ))}
                {agentCAs.map(ca => (
                  <span key={ca} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    CA:{ca.slice(0,6)}…
                  </span>
                ))}
                {agentCoins.length === 0 && agentCAs.length === 0 && (
                  <span className="text-xs text-gray-400">None selected</span>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {COIN_OPTIONS.map(c => (
                    <button key={c}
                      onClick={() => setSelectedCoins(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        selectedCoins.includes(c)
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-emerald-300'
                      }`}
                    >{c}</button>
                  ))}
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Custom CA (meme coins)</div>
                  <div className="flex gap-1.5">
                    <input value={customCA} onChange={e => setCustomCA(e.target.value)}
                      placeholder="Contract address..."
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 outline-none focus:border-emerald-400"/>
                    <button onClick={addCustomCA} className="px-2 py-1.5 bg-purple-500 text-white text-xs rounded-lg">Add</button>
                  </div>
                  {customCAs.map(ca => (
                    <div key={ca} className="flex items-center justify-between mt-1 bg-purple-50 rounded px-2 py-1">
                      <span className="text-xs text-purple-700">{ca.slice(0,12)}…</span>
                      <button onClick={() => setCustomCAs(p => p.filter(x => x !== ca))} className="text-red-400 text-xs">×</button>
                    </div>
                  ))}
                </div>
                <button onClick={saveCoins} disabled={saving}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save coins'}
                </button>
              </div>
            )}
          </div>

          {/* Forum Sentiment */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Forum sentiment</div>
            <div className="space-y-2">
              {[
                { key: 'reddit',      label: 'Reddit',      icon: '🟠', sub: 'r/CryptoMoonShots' },
                { key: 'fourchan',    label: '4chan /biz/',  icon: '🟢', sub: 'Catalog scan'       },
                { key: 'cryptopanic', label: 'CryptoPanic', icon: '🔴', sub: 'News feed'          },
              ].map(({ key, label, icon, sub }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{icon}</span>
                    <div>
                      <div className="text-xs font-medium text-gray-700">{label}</div>
                      <div className="text-xs text-gray-400">{sub}</div>
                    </div>
                  </div>
                  <button onClick={() => toggleForum(key)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${forums[key] ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${forums[key] ? 'left-4.5' : 'left-0.5'}`}/>
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📊</span>
                  <div>
                    <div className="text-xs font-medium text-gray-700">Fear & Greed</div>
                    <div className="text-xs text-gray-400">Always active</div>
                  </div>
                </div>
                <span className="text-xs text-emerald-500 font-medium">On</span>
              </div>
            </div>
          </div>

          {/* Polymarket */}
          <div className="bg-white border border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span>🎯</span>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Polymarket</div>
                  <div className="text-xs text-gray-400">{openBets.length} open · Win rate: {polyWinRate === '—' ? 'No data' : `${polyWinRate}%`}</div>
                </div>
              </div>
              <button onClick={() => setShowBets(!showBets)} className="text-xs text-purple-500 hover:text-purple-700">
                {showBets ? 'Hide' : 'Show all'}
              </button>
            </div>

            {/* Open bets */}
            {openBets.length === 0 ? (
              <div className="text-xs text-gray-400 mb-3">No open bets yet — agent places bets automatically</div>
            ) : (
              <div className="space-y-2 mb-3">
                {(showBets ? openBets : openBets.slice(0, 2)).map(bet => (
                  <div key={bet.id} className="bg-purple-50 border border-purple-100 rounded-lg p-2.5">
                    <div className="text-xs text-purple-800 font-medium mb-1 line-clamp-2">{bet.question}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">{bet.outcome}</span>
                      <span>Stake: <b className="text-gray-700">${bet.stake?.toFixed(0)}</b></span>
                      <span>Payout: <b className="text-emerald-600">${bet.potential_payout?.toFixed(0)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resolved bets */}
            {showBets && resolvedBets.length > 0 && (
              <div className="space-y-1.5 mb-3">
                <div className="text-xs font-semibold text-gray-500">Resolved</div>
                {resolvedBets.slice(0, 4).map(bet => (
                  <div key={bet.id} className={`rounded-lg p-2 border text-xs ${bet.result === 'win' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${bet.result === 'win' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {bet.result === 'win' ? '✓ WIN' : '✗ LOSS'}
                      </span>
                      <span className={bet.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {bet.pnl >= 0 ? '+' : ''}${bet.pnl?.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-gray-500 truncate mt-0.5">{bet.question}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Live markets */}
            {polyMarkets.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1.5">Live markets</div>
                <div className="space-y-1.5">
                  {polyMarkets.slice(0, 3).map(m => {
                    const prices  = Array.isArray(m.outcomePrices) ? m.outcomePrices : ['0.5', '0.5']
                    const yesProb = Math.round(parseFloat(prices[0]) * 100)
                    const noProb  = Math.round(parseFloat(prices[1]) * 100)
                    return (
                      <div key={m.id} className="bg-gray-50 rounded-lg px-2.5 py-2">
                        <div className="text-xs text-gray-700 truncate mb-1">{m.question}</div>
                        <div className="flex gap-2 text-xs">
                          <span className="text-emerald-600 font-semibold">Yes {yesProb}%</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-red-500 font-semibold">No {noProb}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Agent wallet */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Agent wallet</div>
            <div className="text-xs text-gray-400 font-mono break-all">
              {agent.wallet_public_key || 'No wallet generated'}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}