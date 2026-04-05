'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TIMEFRAMES = [
  { label: '15M', interval: '1m',  limit: 15  },
  { label: '1H',  interval: '1m',  limit: 60  },
  { label: '4H',  interval: '5m',  limit: 48  },
  { label: '1D',  interval: '15m', limit: 96  },
  { label: '1W',  interval: '1h',  limit: 168 },
]

const typeColors = {
  emerald: 'bg-emerald-50 text-emerald-800',
  amber:   'bg-amber-50 text-amber-800',
  red:     'bg-red-50 text-red-800',
  blue:    'bg-blue-50 text-blue-800',
  purple:  'bg-purple-50 text-purple-800',
}

const COIN_MAP = { BTC:'BTCUSDT', ETH:'ETHUSDT', SOL:'SOLUSDT', BNB:'BNBUSDT', AGENT:'SOLUSDT', MEME:'SOLUSDT' }

function formatPrice(n) {
  if (!n && n !== 0) return '...'
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 })
  if (n >= 1)    return '$' + n.toFixed(2)
  return '$' + n.toFixed(4)
}

function formatTime(ts, interval) {
  const d = new Date(ts)
  if (interval === '1h') return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })
  return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

function MiniChart({ symbol, tf }) {
  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(true)
  const [hovIdx, setHovIdx]   = useState(null)

  useEffect(() => {
    setLoading(true); setCandles([])
    async function fetch_() {
      try {
        const res  = await window.fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf.interval}&limit=${tf.limit}`)
        const data = await res.json()
        setCandles(data.map(d => ({ t:d[0], o:parseFloat(d[1]), h:parseFloat(d[2]), l:parseFloat(d[3]), c:parseFloat(d[4]) })))
      } catch {}
      setLoading(false)
    }
    fetch_()
  }, [symbol, tf])

  const W=500, H=160, padL=60, padR=8, padT=8, padB=24
  const chartW=W-padL-padR, chartH=H-padT-padB
  const closes = candles.map(c=>c.c)
  const minP   = candles.length ? Math.min(...candles.map(c=>c.l))*0.999 : 0
  const maxP   = candles.length ? Math.max(...candles.map(c=>c.h))*1.001 : 1
  const range  = maxP-minP||1
  const toX = i => padL + (i/Math.max(candles.length-1,1))*chartW
  const toY = p => padT + chartH - ((p-minP)/range)*chartH
  const linePath = closes.map((c,i)=>`${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(c).toFixed(1)}`).join(' ')
  const areaPath = closes.length ? `${linePath} L${toX(closes.length-1).toFixed(1)},${(padT+chartH).toFixed(1)} L${toX(0).toFixed(1)},${(padT+chartH).toFixed(1)} Z` : ''
  const isUp     = closes.length>=2 ? closes[closes.length-1]>=closes[0] : true
  const lineColor = isUp ? '#10b981' : '#ef4444'
  const yTicks    = Array.from({length:4},(_,i)=>minP+(range*i)/3)
  const hovCandle = hovIdx!==null ? candles[hovIdx] : null

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden" style={{ position:'relative' }}>
      {loading && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}} className="text-xs text-gray-400 z-10">Loading...</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{height:'160px',cursor:'crosshair',display:'block'}}
        onMouseLeave={()=>setHovIdx(null)}
        onMouseMove={e=>{
          if(!candles.length) return
          const rect=e.currentTarget.getBoundingClientRect()
          const mx=((e.clientX-rect.left)/rect.width)*W
          const idx=Math.round(((mx-padL)/chartW)*(candles.length-1))
          setHovIdx(Math.max(0,Math.min(candles.length-1,idx)))
        }}>
        {yTicks.map((p,i)=>(<line key={i} x1={padL} y1={toY(p).toFixed(1)} x2={padL+chartW} y2={toY(p).toFixed(1)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4"/>))}
        {areaPath && <path d={areaPath} fill={isUp?'#d1fae5':'#fee2e2'} opacity="0.4"/>}
        {linePath  && <path d={linePath}  fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round"/>}
        {hovIdx!==null && hovCandle && (<>
          <line x1={toX(hovIdx).toFixed(1)} y1={padT} x2={toX(hovIdx).toFixed(1)} y2={padT+chartH} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3"/>
          <circle cx={toX(hovIdx).toFixed(1)} cy={toY(hovCandle.c).toFixed(1)} r="3" fill={lineColor} stroke="white" strokeWidth="1.5"/>
          <rect x={0} y={toY(hovCandle.c)-8} width={padL-2} height={16} rx="3" fill={lineColor}/>
          <text x={(padL-2)/2} y={toY(hovCandle.c)+4} textAnchor="middle" fontSize="8" fill="white" fontWeight="700">{formatPrice(hovCandle.c)}</text>
        </>)}
        {yTicks.map((p,i)=>(<text key={i} x={padL-4} y={toY(p)+3} fontSize="8" fill="#9ca3af" textAnchor="end">{formatPrice(p)}</text>))}
        <line x1={padL} y1={padT} x2={padL} y2={padT+chartH} stroke="#e5e7eb" strokeWidth="1"/>
        <line x1={padL} y1={padT+chartH} x2={padL+chartW} y2={padT+chartH} stroke="#e5e7eb" strokeWidth="1"/>
      </svg>
    </div>
  )
}

const seedLog = [
  { color:'emerald', label:'Ready', time: new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), msg:'Agent initialised and monitoring markets.', reason:'All systems operational. Waiting for high-probability setups based on configured strategy.' },
]

export default function AgentDetail({ agent, user, onBack }) {
  const [log, setLog]           = useState(seedLog)
  const [prompt_, setPrompt]    = useState('')
  const [loading, setLoading]   = useState(false)
  const [tf, setTf]             = useState(TIMEFRAMES[1])
  const [selectedCoin, setSelectedCoin] = useState(null)
  const [prices, setPrices]     = useState({})
  const [changes, setChanges]   = useState({})
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState('')
  const [agentPrompt, setAgentPrompt] = useState(agent.prompt || '')
  const [riskSettings, setRiskSettings] = useState(agent.risk_settings || {})

  const coins = Array.isArray(agent.coins) ? agent.coins.filter(c => COIN_MAP[c]) : ['BTC']
  const activeCoin = selectedCoin || coins[0] || 'BTC'

  // Fetch prices for agent's coins
  useEffect(() => {
    const symbols = coins.map(c => COIN_MAP[c]).filter(Boolean)
    if (!symbols.length) return
    async function fetchPrices() {
      try {
        const res  = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify([...new Set(symbols)])}`)
        const data = await res.json()
        const p = {}, c = {}
        data.forEach(d => {
          const coin = Object.entries(COIN_MAP).find(([k,v])=>v===d.symbol)?.[0]
          if (coin) {
            p[coin] = parseFloat(d.lastPrice).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
            c[coin] = parseFloat(d.priceChangePercent).toFixed(2)
          }
        })
        setPrices(p); setChanges(c)
      } catch {}
    }
    fetchPrices()
    const iv = setInterval(fetchPrices, 5000)
    return () => clearInterval(iv)
  }, [agent.id])

  async function savePromptToDB() {
    setSaving(true)
    await supabase.from('agents').update({ prompt: agentPrompt, risk_settings: riskSettings }).eq('id', agent.id)
    setSaving(false)
    setSaveMsg('✓ Saved!')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  async function sendPrompt() {
    if (!prompt_.trim() || loading) return
    setLoading(true)
    const userMsg = prompt_; setPrompt('')
    const res  = await fetch('/api/agent', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userInstruction:userMsg, agentPrompt }) })
    const data = await res.json()
    const now  = new Date()
    const t    = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
    setLog(prev => [{ color:'purple', label:'You instructed', time:t, msg:`"${userMsg}"`, reason:data.response }, ...prev])
    setLoading(false)
  }

  const ret = parseFloat(agent.total_return || 0)

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        ← Back to all agents
      </button>

      {/* Agent header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg">
          {agent.name?.slice(0,2)?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{agent.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">● Active</span>
            {agent.is_copy && <span className="text-xs text-gray-400">Copied from {agent.copied_from}</span>}
            <span className="text-xs text-gray-400">Wallet: {agent.wallet_public_key?.slice(0,8)}...{agent.wallet_public_key?.slice(-6)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          ['Portfolio value', `$${(agent.portfolio_value||10000).toLocaleString()}`, 'in agent wallet', ''],
          ['Total return',    `${ret>=0?'+':''}${ret.toFixed(1)}%`,                  'since deployment', ret>=0?'text-emerald-600':'text-red-500'],
          ['Win rate',        `${agent.win_rate||0}%`,                               'last 30 trades',   ''],
          ['Max drawdown',    `-${Math.abs(agent.max_drawdown||0)}%`,                'within limit',     'text-red-500'],
        ].map(([l,v,s,c])=>(
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className={`text-xl font-semibold ${c||'text-gray-900'}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {/* Coin selector */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {coins.map(c => {
          const isPos = parseFloat(changes[c]||0) >= 0
          return (
            <div key={c} onClick={() => setSelectedCoin(c)}
              className={`rounded-lg p-3 cursor-pointer border transition-all ${activeCoin===c?'bg-white border-emerald-400 shadow-sm':'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">{c}/USDT</span>
                <span className={`text-xs font-medium ${isPos?'text-emerald-600':'text-red-500'}`}>
                  {changes[c] ? `${isPos?'+':''}${changes[c]}%` : '...'}
                </span>
              </div>
              <div className="text-lg font-semibold text-gray-900">${prices[c]||'...'}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">
          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">{activeCoin}/USDT</span>
              <div className="flex gap-1">
                {TIMEFRAMES.map(t => (
                  <button key={t.label} onClick={() => setTf(t)}
                    className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${tf.label===t.label?'bg-emerald-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <MiniChart symbol={COIN_MAP[activeCoin]||'BTCUSDT'} tf={tf}/>
          </div>

          {/* Thought log */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Agent thought log</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                <span className="text-xs text-gray-400">ready</span>
              </div>
            </div>
            <div className="flex flex-col gap-0 max-h-64 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i} className="py-2.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[entry.color]}`}>{entry.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{entry.time}</span>
                  </div>
                  <p className="text-xs text-gray-800 mb-1">{entry.msg}</p>
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <input value={prompt_} onChange={e=>setPrompt(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&sendPrompt()}
                placeholder="Ask your agent anything..."
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400 text-gray-900 placeholder-gray-400"/>
              <button onClick={sendPrompt} disabled={loading}
                className="bg-emerald-500 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50">
                {loading ? '...' : 'Ask'}
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Agent prompt */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900">Agent prompt</span>
              {saveMsg && <span className="text-xs text-emerald-600 font-medium">{saveMsg}</span>}
            </div>
            <textarea value={agentPrompt} onChange={e=>setAgentPrompt(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 resize-none h-32 font-mono focus:outline-none focus:border-emerald-400 text-gray-800"/>
            <button onClick={savePromptToDB} disabled={saving}
              className="w-full mt-2 bg-emerald-500 text-white text-xs font-medium py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save prompt'}
            </button>
          </div>

          {/* Risk settings */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Risk settings</div>
            {[
              ['Max risk/trade', 'maxRiskPerTrade', '%'],
              ['Max drawdown',   'maxDrawdown',     '%'],
              ['Max exposure',   'maxExposure',     '%'],
              ['Max single asset','maxSingleAsset', '%'],
              ['Take-profit',    'takeProfitRatio', 'x'],
            ].map(([label, key, unit]) => (
              <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs font-semibold text-gray-900">{riskSettings[key] || '—'}{unit}</span>
              </div>
            ))}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">Trading hours</span>
              <span className="text-xs font-semibold text-gray-900 capitalize">{riskSettings.tradingHours || '24/7'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-gray-500">Aggressiveness</span>
              <span className="text-xs font-semibold text-gray-900 capitalize">{agent.behavior_settings?.aggressiveness || 'balanced'}</span>
            </div>
          </div>

          {/* Wallet */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Agent wallet</div>
            <div className="bg-gray-900 rounded-lg px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"/>
                <span className="text-xs font-mono text-gray-300 truncate">{agent.wallet_public_key?.slice(0,20)}...</span>
              </div>
              <button onClick={() => navigator.clipboard.writeText(agent.wallet_public_key||'')}
                className="text-xs text-gray-400 hover:text-white ml-2">Copy</button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Winnings sent here automatically.</p>
          </div>
        </div>
      </div>
    </div>
  )
}