'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { startPriceStore, stopPriceStore, subscribePrices, getRawPrices, registerCustomCA, unregisterCustomCA } from '@/app/lib/priceStore'

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
  green:   'bg-green-50 text-green-800',
}

const COIN_MAP = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  AVAX: 'AVAXUSDT', MATIC: 'MATICUSDT',
  DOGE: 'DOGEUSDT', PEPE: 'PEPEUSDT',
  WIF: 'WIFUSDT', BONK: 'BONKUSDT', FLOKI: 'FLOKIUSDT',
  AGENT: 'SOLUSDT', MEME: 'SOLUSDT',
}

const ALL_COINS = {
  'Major Crypto': [
    { id:'BTC',   label:'Bitcoin',   icon:'₿'  },
    { id:'ETH',   label:'Ethereum',  icon:'Ξ'  },
    { id:'SOL',   label:'Solana',    icon:'◎'  },
    { id:'BNB',   label:'BNB',       icon:'⬡'  },
    { id:'AVAX',  label:'Avalanche', icon:'▲'  },
    { id:'MATIC', label:'Polygon',   icon:'⬟'  },
  ],
  'Meme Coins': [
    { id:'AGENT', label:'$AGENT',    icon:'⚡' },
    { id:'DOGE',  label:'Dogecoin',  icon:'🐕' },
    { id:'PEPE',  label:'Pepe',      icon:'🐸' },
    { id:'WIF',   label:'dogwifhat', icon:'🎩' },
    { id:'BONK',  label:'Bonk',      icon:'🔨' },
    { id:'FLOKI', label:'Floki',     icon:'🌙' },
  ],
}

// Flat list for search
const ALL_COINS_FLAT = Object.entries(ALL_COINS).flatMap(([cat, coins]) =>
  coins.map(c => ({ ...c, category: cat }))
)

function formatPrice(n) {
  if (!n && n !== 0) return '...'
  if (n >= 1000)  return '$' + n.toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 })
  if (n >= 1)     return '$' + n.toFixed(2)
  if (n >= 0.01)  return '$' + n.toFixed(4)
  return '$' + n.toFixed(8)
}

function MiniChart({ symbol, tf }) {
  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(true)
  const [hovIdx, setHovIdx]   = useState(null)

  useEffect(() => {
    setLoading(true); setCandles([])
    async function load() {
      try {
        const res  = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf.interval}&limit=${tf.limit}`)
        const data = await res.json()
        if (Array.isArray(data)) setCandles(data.map(d => ({ t:d[0], o:parseFloat(d[1]), h:parseFloat(d[2]), l:parseFloat(d[3]), c:parseFloat(d[4]) })))
      } catch {}
      setLoading(false)
    }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
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
    <div className="bg-gray-50 rounded-lg overflow-hidden" style={{position:'relative'}}>
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

export default function AgentDetail({ agent: initialAgent, user, onBack }) {
  const [agent, setAgent]               = useState(initialAgent)
  const [log, setLog]                   = useState([{
    color:'blue', label:'Initialised', time: new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    msg:'Agent ready. Press "Start trading" to begin paper trading with fake tokens.',
    reason:'All systems operational. Will scan markets and make trading decisions every 60 seconds.'
  }])
  const [trades, setTrades]             = useState([])
  const [openPositions, setOpenPositions] = useState([])
  const [prompt_, setPrompt]            = useState('')
  const [loading, setLoading]           = useState(false)
  const [trading, setTrading]           = useState(false)
  const [tf, setTf]                     = useState(TIMEFRAMES[1])
  const [selectedCoin, setSelectedCoin] = useState(null)
  const [prices, setPrices]             = useState({})
  const [changes, setChanges]           = useState({})
  const [saving, setSaving]             = useState(false)
  const [saveMsg, setSaveMsg]           = useState('')
  const [agentPrompt, setAgentPrompt]   = useState(agent.prompt || '')
  const [nextScanIn, setNextScanIn]     = useState(60)
  const [showCoinEditor, setShowCoinEditor] = useState(false)
  const [editCoins, setEditCoins]       = useState([])
  const [savingCoins, setSavingCoins]   = useState(false)
  const [coinSearch, setCoinSearch]     = useState('')
  const [caResult, setCaResult]         = useState(null)
  const [caLoading, setCaLoading]       = useState(false)
  const [caError, setCaError]           = useState('')
  const [customCoinCas, setCustomCoinCas] = useState(agent.custom_coin_cas || {})
  const tradingRef   = useRef(false)
  const intervalRef  = useRef(null)
  const countdownRef = useRef(null)

  const coins      = Array.isArray(agent.coins) ? agent.coins : ['BTC']
  const activeCoin = selectedCoin || coins[0] || 'BTC'

  useEffect(() => {
    // Register any custom CAs stored on this agent
    const cas = agent.custom_coin_cas || {}
    Object.entries(cas).forEach(([sym, ca]) => registerCustomCA(sym, ca))
    startPriceStore()
    const unsub = subscribePrices(({ prices: p, changes: c }) => {
      setPrices(p); setChanges(c)
    })
    return () => {
      unsub(); stopPriceStore()
      // Unregister custom CAs when leaving
      Object.keys(cas).forEach(sym => unregisterCustomCA(sym))
    }
  }, [])

  useEffect(() => {
    async function loadTrades() {
      const { data } = await supabase.from('trades').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }).limit(50)
      setTrades(data || [])
      setOpenPositions((data || []).filter(t => t.status === 'open'))
    }
    loadTrades()
  }, [agent.id])

  async function runTradeScan() {
    if (!tradingRef.current) return
    const t = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
    setLog(prev => [{ color:'blue', label:'Scanning', time:t, msg:'Analysing market conditions...', reason:'Reading from central price hub, calculating RSI + MACD.' }, ...prev])
    try {
      const cachedPrices = getRawPrices()
      const res  = await fetch('/api/trade', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          agentId: agent.id, userId: user.id, coins,
          prompt: agentPrompt, riskSettings: agent.risk_settings,
          behaviorSettings: agent.behavior_settings,
          portfolioValue: agent.portfolio_value,
          openPositions, cachedPrices,
        })
      })
      const data = await res.json()
      const now  = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
      if (data.error || !data.action) {
        setLog(prev => [{ color:'red', label:'Error', time:t, msg:'Trade scan failed', reason: data.error || 'No response from trading engine' }, ...prev])
        return
      }
      if (data.action === 'HOLD') {
        setLog(prev => [{ color:'amber', label:'Hold', time:now, msg:'No trade — holding position.', reason:data.reasoning }, ...prev])
      } else if (data.action === 'CLOSE') {
        const pnl = data.trade?.pnl || 0
        setLog(prev => [{ color: pnl >= 0 ? 'emerald' : 'red', label:'Position closed', time:now,
          msg:`Closed ${data.coin} position at ${formatPrice(data.price)} — PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
          reason:data.reasoning }, ...prev])
        const { data: ua } = await supabase.from('agents').select('*').eq('id', agent.id).single()
        if (ua) setAgent(ua)
      } else {
        setLog(prev => [{ color: data.action === 'BUY' ? 'emerald' : 'red', label:`${data.action} executed`, time:now,
          msg:`${data.action} ${data.coin} at ${formatPrice(data.price)} — ${data.amount?.toFixed(4)} units · Confidence: ${data.confidence}/10`,
          reason:data.reasoning }, ...prev])
        const { data: ua } = await supabase.from('agents').select('*').eq('id', agent.id).single()
        if (ua) setAgent(ua)
      }
      const { data: newTrades } = await supabase.from('trades').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }).limit(50)
      setTrades(newTrades || [])
      setOpenPositions((newTrades || []).filter(t => t.status === 'open'))
    } catch (err) {
      const now = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
      setLog(prev => [{ color:'red', label:'Error', time:now, msg:'Scan failed', reason:err.message }, ...prev])
    }
    setNextScanIn(60)
  }

  function startTrading() {
    tradingRef.current = true; setTrading(true); setNextScanIn(60)
    runTradeScan()
    intervalRef.current  = setInterval(runTradeScan, 60000)
    countdownRef.current = setInterval(() => setNextScanIn(n => Math.max(0, n - 1)), 1000)
    const t = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
    setLog(prev => [{ color:'green', label:'Trading started', time:t, msg:'Paper trading engine active. Using fake tokens — no real money involved.',
      reason:`Scanning every 60 seconds. Portfolio: $${agent.portfolio_value?.toLocaleString()}.` }, ...prev])
  }

  function stopTrading() {
    tradingRef.current = false; setTrading(false)
    clearInterval(intervalRef.current); clearInterval(countdownRef.current)
    const t = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
    setLog(prev => [{ color:'amber', label:'Trading paused', time:t, msg:'Paper trading paused.', reason:'Agent will resume from where it left off when restarted.' }, ...prev])
  }

  useEffect(() => {
    return () => { clearInterval(intervalRef.current); clearInterval(countdownRef.current); tradingRef.current = false }
  }, [])

  async function savePromptToDB() {
    setSaving(true)
    await supabase.from('agents').update({ prompt: agentPrompt }).eq('id', agent.id)
    setSaving(false); setSaveMsg('✓ Saved!'); setTimeout(()=>setSaveMsg(''), 2500)
  }

  async function saveCoins() {
    setSavingCoins(true)
    // Build updated custom_coin_cas — keep only CAs for coins still in editCoins
    const updatedCas = {}
    editCoins.forEach(sym => {
      if (customCoinCas[sym]) updatedCas[sym] = customCoinCas[sym]
    })
    await supabase.from('agents').update({ coins: editCoins, custom_coin_cas: updatedCas }).eq('id', agent.id)
    // Register new custom CAs with price store
    Object.entries(updatedCas).forEach(([sym, ca]) => registerCustomCA(sym, ca))
    // Unregister removed ones
    Object.keys(customCoinCas).forEach(sym => { if (!updatedCas[sym]) unregisterCustomCA(sym) })
    setCustomCoinCas(updatedCas)
    setAgent(a => ({ ...a, coins: editCoins, custom_coin_cas: updatedCas }))
    setSavingCoins(false); setShowCoinEditor(false); setCoinSearch(''); setCaResult(null); setCaError('')
  }

  const isCA = (s) => s.length > 20

  async function searchCA(val) {
    if (!isCA(val)) return
    setCaLoading(true); setCaResult(null); setCaError('')
    try {
      const res  = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${val}`)
      const data = await res.json()
      const pair = data?.pairs?.[0]
      if (!pair) { setCaError('No token found for this address'); setCaLoading(false); return }
      setCaResult({
        id:       pair.baseToken.symbol.toUpperCase(),
        label:    pair.baseToken.name,
        ca:       val,
        price:    parseFloat(pair.priceUsd || 0),
        change24h:parseFloat(pair.priceChange?.h24 || 0),
        chain:    pair.chainId,
        dex:      pair.dexId,
        icon:     '🔍',
      })
    } catch { setCaError('Failed to fetch token data') }
    setCaLoading(false)
  }

  async function sendManualPrompt() {
    if (!prompt_.trim() || loading) return
    setLoading(true)
    const userMsg = prompt_; setPrompt('')
    const res  = await fetch('/api/agent', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userInstruction:userMsg, agentPrompt }) })
    const data = await res.json()
    const now  = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
    setLog(prev => [{ color:'purple', label:'You instructed', time:now, msg:`"${userMsg}"`, reason:data.response }, ...prev])
    setLoading(false)
  }

  const ret          = parseFloat(agent.total_return || 0)
  const portfolioValue = agent.portfolio_value || 10000
  const cashBalance  = parseFloat(agent.cash_balance ?? portfolioValue)
  const investedVal  = parseFloat(agent.invested_value ?? 0)
  const totalPnL = openPositions.reduce((sum, pos) => {
    const currentPrice = parseFloat((prices[pos.coin]||'0').toString().replace(/,/g,''))
    if (!currentPrice) return sum
    return sum + (currentPrice - pos.entry_price) * pos.amount * (pos.type==='BUY'?1:-1)
  }, 0)

  const filteredCoins = coinSearch.trim() && !isCA(coinSearch)
    ? ALL_COINS_FLAT.filter(c =>
        c.id.toLowerCase().includes(coinSearch.toLowerCase()) ||
        c.label.toLowerCase().includes(coinSearch.toLowerCase())
      )
    : null

  function CoinCard({ coin }) {
    const sel    = editCoins.includes(coin.id)
    const price  = prices[coin.id]
    const change = changes[coin.id]
    const isPos  = parseFloat(change || 0) >= 0
    return (
      <button onClick={() => setEditCoins(prev => sel ? prev.filter(c => c !== coin.id) : [...prev, coin.id])}
        className={`rounded-xl p-3 border text-left transition-all ${sel ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-base">{coin.icon}</span>
          {sel && <span className="text-emerald-500 text-xs font-bold">✓</span>}
        </div>
        <div className="text-xs font-bold text-gray-900">{coin.id}</div>
        <div className="text-xs text-gray-400">{coin.label}</div>
        {price && (
          <div className="mt-1">
            <div className="text-xs font-semibold text-gray-700">${price}</div>
            <div className={`text-xs ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>{isPos?'+':''}{change}%</div>
          </div>
        )}
      </button>
    )
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        ← Back to all agents
      </button>

      {/* Coin editor modal */}
      {showCoinEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-900">Edit traded coins</span>
              <button onClick={() => { setShowCoinEditor(false); setCoinSearch(''); setCaResult(null); setCaError('') }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Search / CA input */}
            <div className="relative mb-3">
              <input
                value={coinSearch}
                onChange={e => {
                  const v = e.target.value
                  setCoinSearch(v); setCaResult(null); setCaError('')
                  if (isCA(v)) searchCA(v)
                }}
                placeholder="Search by name / ticker, or paste a contract address..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 pl-9"
              />
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
              {coinSearch && (
                <button onClick={() => { setCoinSearch(''); setCaResult(null); setCaError('') }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
              )}
            </div>

            {/* CA lookup hint */}
            {coinSearch.length > 5 && coinSearch.length <= 20 && (
              <p className="text-xs text-gray-400 mb-3">Tip: paste a full contract address to add any token</p>
            )}

            <div className="overflow-y-auto flex-1">
              {/* Contract address result */}
              {isCA(coinSearch) && (
                <div className="mb-4">
                  {caLoading && <div className="text-center py-6 text-sm text-gray-400">Looking up token...</div>}
                  {caError && <div className="text-center py-6 text-sm text-red-500">{caError}</div>}
                  {caResult && (
                    <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{caResult.label}</div>
                          <div className="text-xs text-gray-500">{caResult.id} · {caResult.chain} · {caResult.dex}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">${caResult.price < 0.01 ? caResult.price.toFixed(8) : caResult.price.toFixed(4)}</div>
                          <div className={`text-xs font-medium ${caResult.change24h >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {caResult.change24h >= 0 ? '+' : ''}{caResult.change24h.toFixed(2)}% 24h
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 font-mono mb-3 break-all">{coinSearch}</div>
                      {editCoins.includes(caResult.id) ? (
                        <button onClick={() => setEditCoins(prev => prev.filter(c => c !== caResult.id))}
                          className="w-full bg-red-50 border border-red-200 text-red-600 text-sm font-medium py-2 rounded-xl hover:bg-red-100">
                          Remove {caResult.id}
                        </button>
                      ) : (
                        <button onClick={() => {
                          setEditCoins(prev => [...prev, caResult.id])
                          setCustomCoinCas(prev => ({ ...prev, [caResult.id]: coinSearch }))
                        }}
                          className="w-full bg-emerald-500 text-white text-sm font-semibold py-2 rounded-xl hover:bg-emerald-600">
                          Add {caResult.id} to agent
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Filtered search results */}
              {filteredCoins && !isCA(coinSearch) && (
                filteredCoins.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {filteredCoins.map(coin => <CoinCard key={coin.id} coin={coin} />)}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-gray-400">
                    No coins found for "{coinSearch}"<br/>
                    <span className="text-xs text-gray-300">Try pasting a contract address instead</span>
                  </div>
                )
              )}

              {/* Default categorised view */}
              {!coinSearch.trim() && Object.entries(ALL_COINS).map(([category, coinList]) => (
                <div key={category} className="mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 pb-1 border-b border-gray-100">{category}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {coinList.map(coin => <CoinCard key={coin.id} coin={coin} />)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => { setShowCoinEditor(false); setCoinSearch(''); setCaResult(null); setCaError('') }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={saveCoins} disabled={savingCoins || editCoins.length === 0}
                className="flex-1 bg-emerald-500 text-white text-sm font-semibold py-2 rounded-xl hover:bg-emerald-600 disabled:opacity-50">
                {savingCoins ? 'Saving...' : `Save (${editCoins.length} coin${editCoins.length !== 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg">
            {agent.name?.slice(0,2)?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{agent.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trading?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                {trading ? '● Trading' : '○ Idle'}
              </span>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">📄 Paper trading — fake tokens</span>
              {trading && <span className="text-xs text-gray-400">Next scan in {nextScanIn}s</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!trading ? (
            <button onClick={startTrading} className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-600 transition-colors">
              ▶ Start trading
            </button>
          ) : (
            <button onClick={stopTrading} className="flex items-center gap-2 bg-red-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-red-600 transition-colors">
              ⏸ Pause
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          ['Cash',         `$${cashBalance.toLocaleString('en-US',{maximumFractionDigits:0})}`, 'available to trade', ''],
          ['Invested',     `$${investedVal.toLocaleString('en-US',{maximumFractionDigits:0})}`, 'in open positions', investedVal > 0 ? 'text-emerald-600' : ''],
          ['Total return', `${ret>=0?'+':''}${ret.toFixed(1)}%`, 'since start', ret>=0?'text-emerald-600':'text-red-500'],
          ['Open PnL',     `${totalPnL>=0?'+':''}$${totalPnL.toFixed(2)}`, 'unrealised', totalPnL>=0?'text-emerald-600':'text-red-500'],
        ].map(([l,v,s,c])=>(
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className={`text-xl font-semibold ${c||'text-gray-900'}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {/* Coin cards */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">Monitored coins</span>
        <button onClick={() => { setEditCoins([...coins]); setShowCoinEditor(true) }}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
          ✏️ Edit coins
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {coins.map(c => {
          const isPos  = parseFloat(changes[c]||0) >= 0
          const hasPos = openPositions.find(p => p.coin === c)
          return (
            <div key={c} onClick={()=>setSelectedCoin(c)}
              className={`rounded-lg p-3 cursor-pointer border transition-all ${activeCoin===c?'bg-white border-emerald-400 shadow-sm':'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">{c}/USDT</span>
                <div className="flex items-center gap-1">
                  {hasPos && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>}
                  <span className={`text-xs font-medium ${isPos?'text-emerald-600':'text-red-500'}`}>
                    {changes[c]?`${isPos?'+':''}${changes[c]}%`:'...'}
                  </span>
                </div>
              </div>
              <div className="text-lg font-semibold text-gray-900">{prices[c] ? `$${prices[c]}` : '...'}</div>
              {hasPos && <div className="text-xs text-emerald-600 mt-0.5 font-medium">● Position open</div>}
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
                  <button key={t.label} onClick={()=>setTf(t)}
                    className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${tf.label===t.label?'bg-emerald-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <MiniChart symbol={COIN_MAP[activeCoin]||'BTCUSDT'} tf={tf}/>
          </div>

          {/* Open positions */}
          {openPositions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">Open positions</div>
              {openPositions.map((pos, i) => {
                const currentPrice = parseFloat((prices[pos.coin]||'0').toString().replace(/,/g,'')) || pos.entry_price
                const pnl = (currentPrice - pos.entry_price) * pos.amount * (pos.type==='BUY'?1:-1)
                const pnlPct = ((pnl / (pos.entry_price * pos.amount)) * 100).toFixed(2)
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${pos.type==='BUY'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{pos.type}</span>
                      <div>
                        <div className="text-xs font-semibold text-gray-900">{pos.coin}/USDT</div>
                        <div className="text-xs text-gray-400">{pos.amount.toFixed(4)} units @ {formatPrice(pos.entry_price)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${pnl>=0?'text-emerald-600':'text-red-500'}`}>{pnl>=0?'+':''}{formatPrice(Math.abs(pnl))}</div>
                      <div className={`text-xs ${pnl>=0?'text-emerald-500':'text-red-400'}`}>{pnl>=0?'+':''}{pnlPct}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Thought log */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Agent thought log</span>
              <div className="flex items-center gap-2">
                {trading && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>}
                <span className="text-xs text-gray-400">{trading ? 'scanning every 60s' : 'idle'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-0 max-h-72 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i} className="py-2.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[entry.color]||typeColors.blue}`}>{entry.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{entry.time}</span>
                  </div>
                  <p className="text-xs text-gray-800 mb-1">{entry.msg}</p>
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <input value={prompt_} onChange={e=>setPrompt(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&sendManualPrompt()}
                placeholder="Ask your agent anything..."
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400 text-gray-900 placeholder-gray-400"/>
              <button onClick={sendManualPrompt} disabled={loading}
                className="bg-emerald-500 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50">
                {loading?'...':'Ask'}
              </button>
            </div>
          </div>

          {/* Trade history */}
          {trades.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">Trade history</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Time','Coin','Type','Entry','Exit','PnL','Status'].map(h=>(
                        <th key={h} className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.slice(0,20).map((t,i)=>(
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3 text-xs text-gray-400 whitespace-nowrap">{new Date(t.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="py-2 pr-3 text-xs font-semibold text-gray-900">{t.coin}</td>
                        <td className="py-2 pr-3"><span className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.type==='BUY'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{t.type}</span></td>
                        <td className="py-2 pr-3 text-xs text-gray-700 font-mono">{formatPrice(t.entry_price)}</td>
                        <td className="py-2 pr-3 text-xs text-gray-700 font-mono">{t.exit_price ? formatPrice(t.exit_price) : '—'}</td>
                        <td className="py-2 pr-3 text-xs font-semibold">
                          {t.pnl ? <span className={t.pnl>=0?'text-emerald-600':'text-red-500'}>{t.pnl>=0?'+':''}{formatPrice(Math.abs(t.pnl))}</span> : '—'}
                        </td>
                        <td className="py-2 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded-full ${t.status==='open'?'bg-blue-50 text-blue-600':'bg-gray-100 text-gray-500'}`}>{t.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900">Agent prompt</span>
              {saveMsg && <span className="text-xs text-emerald-600 font-medium">{saveMsg}</span>}
            </div>
            <textarea value={agentPrompt} onChange={e=>setAgentPrompt(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 resize-none h-36 font-mono focus:outline-none focus:border-emerald-400 text-gray-800"/>
            <button onClick={savePromptToDB} disabled={saving}
              className="w-full mt-2 bg-emerald-500 text-white text-xs font-medium py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50">
              {saving?'Saving...':'Save prompt'}
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Risk settings</div>
            {[
              ['Max risk/trade',   `${agent.risk_settings?.maxRiskPerTrade||2}%`],
              ['Max drawdown',     `${agent.risk_settings?.maxDrawdown||10}%`],
              ['Max exposure',     `${agent.risk_settings?.maxExposure||70}%`],
              ['Max single asset', `${agent.risk_settings?.maxSingleAsset||30}%`],
              ['Take-profit',      `${agent.risk_settings?.takeProfitRatio||3}x`],
              ['Trading hours',    agent.risk_settings?.tradingHours||'24/7'],
              ['Aggressiveness',   agent.behavior_settings?.aggressiveness||'balanced'],
            ].map(([l,v])=>(
              <div key={l} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-500">{l}</span>
                <span className="text-xs font-semibold text-gray-900 capitalize">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Portfolio</div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">Cash</span>
              <span className="font-semibold text-gray-900">${cashBalance.toLocaleString('en-US',{maximumFractionDigits:0})}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-500">Invested</span>
              <span className="font-semibold text-emerald-600">${investedVal.toLocaleString('en-US',{maximumFractionDigits:0})}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
              <div className="h-full flex">
                {(() => {
                  const total = cashBalance + investedVal || 1
                  return <>
                    <div style={{width:`${(cashBalance/total*100).toFixed(1)}%`}} className="bg-gray-300"/>
                    <div style={{width:`${(investedVal/total*100).toFixed(1)}%`}} className="bg-emerald-500"/>
                  </>
                })()}
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Cash</span><span>Invested</span></div>
            <div className="flex justify-between text-xs pt-2 border-t border-gray-100">
              <span className="text-gray-500">Win rate</span>
              <span className="font-semibold text-gray-900">{agent.win_rate||0}%</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Agent wallet</div>
            <div className="bg-gray-900 rounded-lg px-3 py-2.5 flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"/>
                <span className="text-xs font-mono text-gray-300 truncate">{agent.wallet_public_key?.slice(0,18)}...</span>
              </div>
              <button onClick={()=>navigator.clipboard.writeText(agent.wallet_public_key||'')} className="text-xs text-gray-400 hover:text-white ml-2">Copy</button>
            </div>
            <p className="text-xs text-gray-400">Real Solana address — winnings sent here when live trading activates.</p>
          </div>
        </div>
      </div>
    </div>
  )
}