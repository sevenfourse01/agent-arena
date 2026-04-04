'use client'
import { useState, useEffect } from 'react'

const COINS = ['BTC', 'ETH', 'SOL', 'BNB']

const TIMEFRAMES = [
  { label: '15M', interval: '15m', limit: 96 },
  { label: '1H',  interval: '1h',  limit: 48 },
  { label: '4H',  interval: '4h',  limit: 42 },
  { label: '1D',  interval: '1d',  limit: 30 },
  { label: '1W',  interval: '1w',  limit: 52 },
]

const seedLog = [
  { color: 'emerald', label: 'Trade executed', time: '14:32:01',
    msg: 'Bought 0.28 BTC at $43,820 — allocated 22% of portfolio.',
    reason: 'MACD crossed bullish on 1h. RSI at 54, room to run. Sentiment +0.6 from 3 sources. Stop $42,900, target $45,200.' },
  { color: 'amber', label: 'Risk check', time: '14:28:44',
    msg: 'Portfolio exposure 64% — within 70% limit.',
    reason: 'BTC 22%, ETH 18%, SOL 14%, cash 46%. Max drawdown at -3.1%, limit -10%.' },
  { color: 'red', label: 'Stop triggered', time: '11:14:22',
    msg: 'Closed SOL at $138.40 — stop-loss hit. Loss -$182 (-1.8%).',
    reason: 'Price broke below support at $140. Volume spike confirmed downside. Will re-evaluate next session.' },
  { color: 'blue', label: 'Scanning', time: '14:33:10',
    msg: 'Monitoring ETH, BNB, $AGENT for next entry.',
    reason: 'ETH RSI overbought at 71 — waiting for pullback. $AGENT showing volume spike — watching.' },
]

const typeColors = {
  emerald: 'bg-emerald-50 text-emerald-800',
  amber:   'bg-amber-50 text-amber-800',
  red:     'bg-red-50 text-red-800',
  blue:    'bg-blue-50 text-blue-800',
  purple:  'bg-purple-50 text-purple-800',
}

function formatPrice(n) {
  if (!n && n !== 0) return '...'
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  if (n >= 1)    return '$' + n.toFixed(2)
  return '$' + n.toFixed(4)
}

function formatTime(ts, interval) {
  const d = new Date(ts)
  if (interval === '1d' || interval === '1w') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function ProChart({ coin, currentPrice }) {
  const [tf, setTf]           = useState(TIMEFRAMES[1])
  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(true)
  const [hovIdx, setHovIdx]   = useState(null)

  useEffect(() => {
    setLoading(true)
    setCandles([])
    async function fetchCandles() {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${coin}USDT&interval=${tf.interval}&limit=${tf.limit}`
        )
        const data = await res.json()
        setCandles(data.map(d => ({
          t: d[0],
          o: parseFloat(d[1]),
          h: parseFloat(d[2]),
          l: parseFloat(d[3]),
          c: parseFloat(d[4]),
        })))
      } catch (e) {}
      setLoading(false)
    }
    fetchCandles()
    const iv = setInterval(fetchCandles, 30000)
    return () => clearInterval(iv)
  }, [coin, tf])

  const W = 600, H = 220
  const padL = 72  // left: space for Y axis labels
  const padR = 8   // right: minimal padding
  const padT = 12
  const padB = 32
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const lows   = candles.map(c => c.l)
  const highs  = candles.map(c => c.h)
  const closes = candles.map(c => c.c)
  const minP   = candles.length ? Math.min(...lows)  * 0.9993 : 0
  const maxP   = candles.length ? Math.max(...highs) * 1.0007 : 1
  const range  = maxP - minP || 1

  const toX = i => padL + (i / Math.max(candles.length - 1, 1)) * chartW
  const toY = p => padT + chartH - ((p - minP) / range) * chartH

  const linePath = closes.map((c, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(c).toFixed(1)}`).join(' ')
  const areaPath = closes.length
    ? `${linePath} L${toX(closes.length - 1).toFixed(1)},${(padT + chartH).toFixed(1)} L${toX(0).toFixed(1)},${(padT + chartH).toFixed(1)} Z`
    : ''

  const isUp      = closes.length >= 2 ? closes[closes.length - 1] >= closes[0] : true
  const lineColor = isUp ? '#10b981' : '#ef4444'
  const areaColor = isUp ? '#d1fae5' : '#fee2e2'

  const yTicks = Array.from({ length: 5 }, (_, i) => minP + (range * i) / 4)
  const xStep  = Math.max(1, Math.floor(candles.length / 5))
  const xTicks = candles.map((c, i) => ({ c, i })).filter(({ i }) => i % xStep === 0)

  const hovCandle = hovIdx !== null ? candles[hovIdx] : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{coin}/USDT</span>
          {hovCandle ? (
            <span className="text-xs text-gray-500">
              O:<b className="text-gray-700"> {formatPrice(hovCandle.o)}</b>&nbsp;
              H:<b className="text-gray-700"> {formatPrice(hovCandle.h)}</b>&nbsp;
              L:<b className="text-gray-700"> {formatPrice(hovCandle.l)}</b>&nbsp;
              C:<b className="text-gray-700"> {formatPrice(hovCandle.c)}</b>
            </span>
          ) : (
            <span className="text-xs text-gray-400">{currentPrice ? `$${currentPrice}` : '...'}</span>
          )}
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map(t => (
            <button key={t.label} onClick={() => setTf(t)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${tf.label === t.label ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#f9fafb', position: 'relative' }}>
        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}
            className="text-xs text-gray-400 z-10 bg-gray-50">Loading...</div>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: '240px', cursor: 'crosshair', display: 'block' }}
          onMouseLeave={() => setHovIdx(null)}
          onMouseMove={e => {
            if (!candles.length) return
            const rect = e.currentTarget.getBoundingClientRect()
            const mx = ((e.clientX - rect.left) / rect.width) * W
            const idx = Math.round(((mx - padL) / chartW) * (candles.length - 1))
            setHovIdx(Math.max(0, Math.min(candles.length - 1, idx)))
          }}
        >
          {/* Horizontal grid lines */}
          {yTicks.map((p, i) => (
            <line key={i}
              x1={padL} y1={toY(p).toFixed(1)}
              x2={padL + chartW} y2={toY(p).toFixed(1)}
              stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
          ))}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill={areaColor} opacity="0.45" />}

          {/* Price line */}
          {linePath && <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />}

          {/* Crosshair */}
          {hovIdx !== null && hovCandle && (
            <>
              <line x1={toX(hovIdx).toFixed(1)} y1={padT}
                    x2={toX(hovIdx).toFixed(1)} y2={padT + chartH}
                    stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3" />
              <line x1={padL} y1={toY(hovCandle.c).toFixed(1)}
                    x2={padL + chartW} y2={toY(hovCandle.c).toFixed(1)}
                    stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={toX(hovIdx).toFixed(1)} cy={toY(hovCandle.c).toFixed(1)}
                      r="4" fill={lineColor} stroke="white" strokeWidth="1.5" />
              {/* Hover price label on LEFT Y axis */}
              <rect x={0} y={toY(hovCandle.c) - 10} width={padL - 2} height={20} rx="4" fill={lineColor} />
              <text x={(padL - 2) / 2} y={toY(hovCandle.c) + 4.5}
                    textAnchor="middle" fontSize="9.5" fill="white" fontWeight="700">
                {formatPrice(hovCandle.c)}
              </text>
            </>
          )}

          {/* Y axis labels — LEFT side */}
          {yTicks.map((p, i) => (
            <text key={i}
              x={padL - 5} y={toY(p) + 4}
              fontSize="9" fill="#6b7280" textAnchor="end">
              {formatPrice(p)}
            </text>
          ))}

          {/* Y axis vertical line */}
          <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#d1d5db" strokeWidth="1" />

          {/* X axis line */}
          <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH}
                stroke="#d1d5db" strokeWidth="1" />

          {/* X axis labels */}
          {xTicks.map(({ c, i }) => (
            <text key={i}
              x={toX(i)} y={padT + chartH + 20}
              fontSize="9" fill="#9ca3af" textAnchor="middle">
              {formatTime(c.t, tf.interval)}
            </text>
          ))}
        </svg>
      </div>

      {/* Indicator badges */}
      <div className="flex gap-2 flex-wrap mt-3">
        {[['RSI 54 — neutral','emerald'],['MACD bullish cross','emerald'],['MA50 > MA200','emerald'],['Volume avg','gray'],['Sentiment: mixed','red']].map(([l,c])=>(
          <span key={l} className={`text-xs px-2 py-0.5 rounded-full font-medium ${c==='emerald'?'bg-emerald-50 text-emerald-800':c==='red'?'bg-red-50 text-red-700':'bg-gray-100 text-gray-500'}`}>{l}</span>
        ))}
      </div>
    </div>
  )
}

export default function Cockpit() {
  const [coin, setCoin]               = useState('BTC')
  const [log, setLog]                 = useState(seedLog)
  const [prompt, setPrompt]           = useState('')
  const [loading, setLoading]         = useState(false)
  const [autoRunning, setAutoRunning] = useState(true)
  const [prices, setPrices]           = useState({ BTC: null, ETH: null, SOL: null, BNB: null })
  const [changes, setChanges]         = useState({ BTC: null, ETH: null, SOL: null, BNB: null })
  const [agentPrompt, setAgentPrompt] = useState(
`You are an autonomous trading agent on Agent Arena.
Monitor: BTC, ETH, SOL, $AGENT
Strategy: momentum + sentiment hybrid
Risk per trade: max 2% of portfolio
Max drawdown: -10% total
Max exposure: 70% at any time
Stop-loss: trailing 2%
Take-profit: 1:3 risk/reward
Use RSI, MACD, MA crossovers.
Explain every decision in plain English.`)

  useEffect(() => {
    async function fetchPrices() {
      try {
        const symbols = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT']
        const res  = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`)
        const data = await res.json()
        const p = {}, c = {}
        data.forEach(d => {
          const key = d.symbol.replace('USDT','')
          p[key] = parseFloat(d.lastPrice).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
          c[key] = parseFloat(d.priceChangePercent).toFixed(2)
        })
        setPrices(p); setChanges(c)
      } catch(e) {}
    }
    fetchPrices()
    const iv = setInterval(fetchPrices, 5000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!autoRunning) return
    const iv = setInterval(async () => {
      const opts = [
        'Scan current market conditions and report what you see',
        'Check if any positions need adjusting based on current RSI levels',
        'Review portfolio exposure and suggest any rebalancing',
        'Look for new entry opportunities across monitored coins',
        'Run a risk check on all open positions',
      ]
      const p   = opts[Math.floor(Math.random() * opts.length)]
      const res = await fetch('/api/agent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userInstruction: p, agentPrompt }) })
      const data = await res.json()
      const now = new Date()
      const t   = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
      setLog(prev => [{ color:'blue', label:'Auto scan', time:t, msg:p, reason:data.response }, ...prev])
    }, 30000)
    return () => clearInterval(iv)
  }, [autoRunning, agentPrompt])

  async function sendPrompt() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    const userMsg = prompt; setPrompt('')
    const res  = await fetch('/api/agent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userInstruction: userMsg, agentPrompt }) })
    const data = await res.json()
    const now  = new Date()
    const t    = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
    setLog(prev => [{ color:'purple', label:'You instructed', time:t, msg:`"${userMsg}"`, reason:data.response }, ...prev])
    setLoading(false)
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[['Portfolio value','$12,841','+$1,204 today',''],
          ['Total return','+28.4%','since deployment','text-emerald-600'],
          ['Win rate','71%','last 30 trades',''],
          ['Max drawdown','-8.2%','within limit','text-red-500']
        ].map(([l,v,s,c])=>(
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className={`text-xl font-semibold ${c || 'text-gray-900'}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {COINS.map(c => (
          <div key={c} onClick={() => setCoin(c)}
            className={`rounded-lg p-3 cursor-pointer border transition-all ${coin===c ? 'bg-white border-emerald-400 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-gray-500">{c}/USDT</span>
              <span className={`text-xs font-medium ${changes[c] >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {changes[c] ? `${changes[c] >= 0 ? '+' : ''}${changes[c]}%` : '...'}
              </span>
            </div>
            <div className="text-lg font-semibold text-gray-900">${prices[c] || '...'}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">

          <ProChart coin={coin} currentPrice={prices[coin]} />

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Agent thought log</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                <span className="text-xs text-gray-400">live</span>
                <button onClick={() => setAutoRunning(p => !p)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${autoRunning ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                  {autoRunning ? 'auto: on' : 'auto: off'}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-0 max-h-72 overflow-y-auto">
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
              <input value={prompt} onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendPrompt()}
                placeholder="Tell the agent something... e.g. 'Be more aggressive on BTC'"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400 text-gray-900 placeholder-gray-400"/>
              <button onClick={sendPrompt} disabled={loading}
                className="bg-emerald-500 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50">
                {loading ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Open positions</div>
            {[['BTC/USDT','0.28 BTC · $43,820','+$420 +3.1%','text-emerald-600'],
              ['ETH/USDT','1.4 ETH · $3,210','+$218 +1.8%','text-emerald-600'],
              ['$AGENT/USDT','1,240 · $0.042','-$44 -0.9%','text-red-500']
            ].map(([pair,det,pnl,c])=>(
              <div key={pair} className="py-2.5 border-b border-gray-100 last:border-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs font-semibold text-gray-900">{pair}</span>
                  <span className={`text-xs font-medium ${c}`}>{pnl}</span>
                </div>
                <span className="text-xs text-gray-500">{det}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Agent prompt</div>
            <textarea value={agentPrompt} onChange={e => setAgentPrompt(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 resize-none h-40 font-mono focus:outline-none focus:border-emerald-400 text-gray-800"/>
            <button className="w-full mt-2 bg-emerald-500 text-white text-xs font-medium py-2 rounded-lg">
              Save and redeploy agent
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Signal sources</div>
            {['Price action (OHLCV)','RSI / MACD / MAs','News sentiment','Social (X / Reddit)','On-chain volume'].map((s,i)=>(
              <div key={s} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-700">{s}</span>
                <div className={`w-8 h-4 rounded-full relative cursor-pointer ${i<4?'bg-emerald-500':'bg-gray-200'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 ${i<4?'right-0.5':'left-0.5'}`}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}