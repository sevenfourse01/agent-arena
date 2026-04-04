'use client'
import { useState, useEffect } from 'react'

const COINS = ['BTC', 'ETH', 'SOL', 'BNB']

const TIMEFRAMES = [
  { label: '15M', interval: '1m',  limit: 15  },
  { label: '1H',  interval: '1m',  limit: 60  },
  { label: '4H',  interval: '5m',  limit: 48  },
  { label: '1D',  interval: '15m', limit: 96  },
  { label: '1W',  interval: '1h',  limit: 168 },
]

const CHART_TYPES = [
  { id: 'area',           label: 'Area'             },
  { id: 'line',           label: 'Line'             },
  { id: 'line_markers',   label: 'Line with Markers'},
  { id: 'candles',        label: 'Candles'          },
  { id: 'hollow_candles', label: 'Hollow Candles'   },
  { id: 'bars',           label: 'Bars'             },
  { id: 'step_line',      label: 'Step Line'        },
  { id: 'hlc_area',       label: 'HLC Area'         },
  { id: 'baseline',       label: 'Baseline'         },
  { id: 'columns',        label: 'Columns'          },
  { id: 'high_low',       label: 'High-Low'         },
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
  if (interval === '1h') return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function renderChart(type, candles, toX, toY, padL, padT, chartW, chartH) {
  if (!candles.length) return null
  const n      = candles.length
  const closes = candles.map(c => c.c)
  const highs  = candles.map(c => c.h)
  const lows   = candles.map(c => c.l)
  const cw     = Math.max(1.5, Math.min(10, chartW / n * 0.7))
  const up = '#10b981', dn = '#ef4444'
  const isUp  = i => candles[i].c >= candles[i].o
  const col   = i => isUp(i) ? up : dn
  const overallUp = closes[n-1] >= closes[0]
  const lineColor = overallUp ? up : dn
  const linePath  = closes.map((c,i) => `${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(c).toFixed(1)}`).join(' ')

  if (type === 'candles') return candles.map((c,i) => {
    const x=toX(i), bT=toY(Math.max(c.o,c.c)), bB=toY(Math.min(c.o,c.c))
    return <g key={i}><line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={col(i)} strokeWidth="1"/><rect x={x-cw/2} y={bT} width={cw} height={Math.max(1,bB-bT)} fill={col(i)}/></g>
  })

  if (type === 'hollow_candles') return candles.map((c,i) => {
    const x=toX(i), bT=toY(Math.max(c.o,c.c)), bB=toY(Math.min(c.o,c.c))
    return <g key={i}><line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={col(i)} strokeWidth="1"/><rect x={x-cw/2} y={bT} width={cw} height={Math.max(1,bB-bT)} fill={isUp(i)?'none':col(i)} stroke={col(i)} strokeWidth="1"/></g>
  })

  if (type === 'bars') return candles.map((c,i) => {
    const x=toX(i), tk=Math.max(2,cw*0.7)
    return <g key={i}><line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={col(i)} strokeWidth="1.5"/><line x1={x-tk} y1={toY(c.o)} x2={x} y2={toY(c.o)} stroke={col(i)} strokeWidth="1.5"/><line x1={x} y1={toY(c.c)} x2={x+tk} y2={toY(c.c)} stroke={col(i)} strokeWidth="1.5"/></g>
  })

  if (type === 'line') return <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round"/>

  if (type === 'line_markers') return <g>
    <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round"/>
    {closes.map((c,i) => <circle key={i} cx={toX(i)} cy={toY(c)} r={Math.max(1.5,Math.min(3,100/n))} fill={lineColor}/>)}
  </g>

  if (type === 'step_line') {
    let p = `M${toX(0).toFixed(1)},${toY(closes[0]).toFixed(1)}`
    for (let i=1;i<closes.length;i++) p += ` L${toX(i).toFixed(1)},${toY(closes[i-1]).toFixed(1)} L${toX(i).toFixed(1)},${toY(closes[i]).toFixed(1)}`
    return <path d={p} fill="none" stroke={lineColor} strokeWidth="2"/>
  }

  if (type === 'area') {
    const areaPath = linePath + ` L${toX(n-1).toFixed(1)},${(padT+chartH).toFixed(1)} L${toX(0).toFixed(1)},${(padT+chartH).toFixed(1)} Z`
    return <g><path d={areaPath} fill={overallUp?'#d1fae5':'#fee2e2'} opacity="0.5"/><path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round"/></g>
  }

  if (type === 'hlc_area') {
    const hPath = highs.map((h,i)=>`${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(h).toFixed(1)}`).join(' ')
    const lPath = [...lows].reverse().map((l,i)=>`L${toX(n-1-i).toFixed(1)},${toY(l).toFixed(1)}`).join(' ')
    const cPath = closes.map((c,i)=>`${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(c).toFixed(1)}`).join(' ')
    return <g><path d={hPath+' '+lPath+' Z'} fill="#bfdbfe" opacity="0.35"/><path d={hPath} fill="none" stroke="#93c5fd" strokeWidth="1"/><path d={cPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"/></g>
  }

  if (type === 'baseline') {
    const baseY = toY(closes[0])
    const aPath = linePath + ` L${toX(n-1).toFixed(1)},${baseY.toFixed(1)} L${toX(0).toFixed(1)},${baseY.toFixed(1)} Z`
    return <g>
      <defs>
        <clipPath id="aboveBase"><rect x={padL} y={padT} width={chartW} height={Math.max(0,baseY-padT)}/></clipPath>
        <clipPath id="belowBase"><rect x={padL} y={baseY} width={chartW} height={chartH-(baseY-padT)}/></clipPath>
      </defs>
      <path d={aPath} fill="#d1fae5" opacity="0.5" clipPath="url(#aboveBase)"/>
      <path d={aPath} fill="#fee2e2" opacity="0.5" clipPath="url(#belowBase)"/>
      <path d={linePath} fill="none" stroke="#6b7280" strokeWidth="2" strokeLinejoin="round"/>
      <line x1={padL} y1={baseY} x2={padL+chartW} y2={baseY} stroke="#9ca3af" strokeWidth="1" strokeDasharray="5,3"/>
    </g>
  }

  if (type === 'columns') return candles.map((c,i) => {
    const x=toX(i), bTop=toY(c.c), bBot=padT+chartH
    return <rect key={i} x={x-cw/2} y={bTop} width={cw} height={Math.max(1,bBot-bTop)} fill={col(i)} opacity="0.8"/>
  })

  if (type === 'high_low') return candles.map((c,i) => (
    <line key={i} x1={toX(i)} y1={toY(c.h)} x2={toX(i)} y2={toY(c.l)} stroke={col(i)} strokeWidth={Math.max(1,cw*0.5)}/>
  ))

  return null
}

function ProChart({ coin, currentPrice, onTfChange }) {
  const [tf, setTf]             = useState(TIMEFRAMES[1])
  const [chartType, setChartType] = useState('area')
  const [candles, setCandles]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [hovIdx, setHovIdx]     = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [tfChange, setTfChange] = useState(null)

  useEffect(() => {
    setLoading(true)
    setCandles([])
    setTfChange(null)
    async function fetchCandles() {
      try {
        const res  = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin}USDT&interval=${tf.interval}&limit=${tf.limit}`)
        const data = await res.json()
        const parsed = data.map(d => ({
          t: d[0], o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4])
        }))
        setCandles(parsed)
        if (parsed.length >= 2) {
          const open  = parsed[0].o
          const close = parsed[parsed.length - 1].c
          const pct   = ((close - open) / open * 100).toFixed(2)
          setTfChange(pct)
          if (onTfChange) onTfChange(coin, pct)
        }
      } catch(e) {}
      setLoading(false)
    }
    fetchCandles()
    const iv = setInterval(fetchCandles, 30000)
    return () => clearInterval(iv)
  }, [coin, tf])

  const W=600, H=220, padL=72, padR=8, padT=12, padB=32
  const chartW=W-padL-padR, chartH=H-padT-padB

  const lows   = candles.map(c=>c.l)
  const highs  = candles.map(c=>c.h)
  const closes = candles.map(c=>c.c)
  const minP   = candles.length ? Math.min(...lows)*0.9993  : 0
  const maxP   = candles.length ? Math.max(...highs)*1.0007 : 1
  const range  = maxP-minP||1

  const toX = i => padL + (i/Math.max(candles.length-1,1))*chartW
  const toY = p => padT + chartH - ((p-minP)/range)*chartH

  const yTicks = Array.from({length:5},(_,i)=>minP+(range*i)/4)
  const xStep  = Math.max(1,Math.floor(candles.length/5))
  const xTicks = candles.map((c,i)=>({c,i})).filter(({i})=>i%xStep===0)
  const hovCandle = hovIdx!==null ? candles[hovIdx] : null
  const currentLabel = CHART_TYPES.find(t=>t.id===chartType)?.label

  function handleTfChange(t) {
    setTf(t)
    if (onTfChange) onTfChange(coin, null)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
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
            <span className="text-xs text-gray-400">
              {currentPrice ? `$${currentPrice}` : '...'}
              {tfChange !== null && (
                <span className={`ml-2 font-semibold ${parseFloat(tfChange) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {parseFloat(tfChange) >= 0 ? '+' : ''}{tfChange}% ({tf.label})
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Chart type dropdown */}
          <div className="relative">
            <button onClick={() => setShowMenu(m=>!m)}
              className="text-xs px-2.5 py-1 rounded border border-gray-200 bg-gray-50 text-gray-700 font-medium flex items-center gap-1 hover:bg-gray-100 whitespace-nowrap">
              {currentLabel} <span className="text-gray-400">▾</span>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-xl z-30 w-44 py-1">
                {CHART_TYPES.map(t => (
                  <button key={t.id} onClick={()=>{setChartType(t.id);setShowMenu(false)}}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${chartType===t.id?'bg-emerald-50 text-emerald-700 font-semibold':'text-gray-700 hover:bg-gray-50'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Timeframes */}
          <div className="flex gap-1">
            {TIMEFRAMES.map(t => (
              <button key={t.label} onClick={() => handleTfChange(t)}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${tf.label===t.label?'bg-emerald-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{background:'#f9fafb',position:'relative'}} onClick={()=>setShowMenu(false)}>
        {loading && (
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}
            className="text-xs text-gray-400 z-10 bg-gray-50">Loading...</div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none"
          style={{height:'240px',cursor:'crosshair',display:'block'}}
          onMouseLeave={()=>setHovIdx(null)}
          onMouseMove={e=>{
            if(!candles.length) return
            const rect=e.currentTarget.getBoundingClientRect()
            const mx=((e.clientX-rect.left)/rect.width)*W
            const idx=Math.round(((mx-padL)/chartW)*(candles.length-1))
            setHovIdx(Math.max(0,Math.min(candles.length-1,idx)))
          }}>
          {yTicks.map((p,i)=>(
            <line key={i} x1={padL} y1={toY(p).toFixed(1)} x2={padL+chartW} y2={toY(p).toFixed(1)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4"/>
          ))}
          {candles.length>0 && renderChart(chartType,candles,toX,toY,padL,padT,chartW,chartH)}
          {hovIdx!==null && hovCandle && (<>
            <line x1={toX(hovIdx).toFixed(1)} y1={padT} x2={toX(hovIdx).toFixed(1)} y2={padT+chartH} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3"/>
            <line x1={padL} y1={toY(hovCandle.c).toFixed(1)} x2={padL+chartW} y2={toY(hovCandle.c).toFixed(1)} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3"/>
            <circle cx={toX(hovIdx).toFixed(1)} cy={toY(hovCandle.c).toFixed(1)} r="4" fill="#374151" stroke="white" strokeWidth="1.5"/>
            <rect x={0} y={toY(hovCandle.c)-10} width={padL-2} height={20} rx="4" fill="#374151"/>
            <text x={(padL-2)/2} y={toY(hovCandle.c)+4.5} textAnchor="middle" fontSize="9.5" fill="white" fontWeight="700">{formatPrice(hovCandle.c)}</text>
          </>)}
          {yTicks.map((p,i)=>(
            <text key={i} x={padL-5} y={toY(p)+4} fontSize="9" fill="#6b7280" textAnchor="end">{formatPrice(p)}</text>
          ))}
          <line x1={padL} y1={padT} x2={padL} y2={padT+chartH} stroke="#d1d5db" strokeWidth="1"/>
          <line x1={padL} y1={padT+chartH} x2={padL+chartW} y2={padT+chartH} stroke="#d1d5db" strokeWidth="1"/>
          {xTicks.map(({c,i})=>(
            <text key={i} x={toX(i)} y={padT+chartH+20} fontSize="9" fill="#9ca3af" textAnchor="middle">{formatTime(c.t,tf.interval)}</text>
          ))}
        </svg>
      </div>

      <div className="flex gap-2 flex-wrap mt-3">
        {[['RSI 54 — neutral','emerald'],['MACD bullish cross','emerald'],['MA50 > MA200','emerald'],['Volume avg','gray'],['Sentiment: mixed','red']].map(([l,c])=>(
          <span key={l} className={`text-xs px-2 py-0.5 rounded-full font-medium ${c==='emerald'?'bg-emerald-50 text-emerald-800':c==='red'?'bg-red-50 text-red-700':'bg-gray-100 text-gray-500'}`}>{l}</span>
        ))}
      </div>
    </div>
  )
}

export default function Cockpit() {
  const [coin, setCoin]         = useState('BTC')
  const [log, setLog]           = useState(seedLog)
  const [prompt, setPrompt]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [prices, setPrices]     = useState({ BTC: null, ETH: null, SOL: null, BNB: null })
  const [changes, setChanges]   = useState({ BTC: null, ETH: null, SOL: null, BNB: null })
  const [tfChanges, setTfChanges] = useState({ BTC: null, ETH: null, SOL: null, BNB: null })
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
          p[key] = parseFloat(d.lastPrice).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
          c[key] = parseFloat(d.priceChangePercent).toFixed(2)
        })
        setPrices(p); setChanges(c)
      } catch(e) {}
    }
    fetchPrices()
    const iv = setInterval(fetchPrices, 5000)
    return () => clearInterval(iv)
  }, [])

  function handleTfChange(coinKey, pct) {
    setTfChanges(prev => ({ ...prev, [coinKey]: pct }))
  }

  async function sendPrompt() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    const userMsg = prompt; setPrompt('')
    const res  = await fetch('/api/agent', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userInstruction:userMsg,agentPrompt})})
    const data = await res.json()
    const now  = new Date()
    const t    = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
    setLog(prev => [{color:'purple',label:'You instructed',time:t,msg:`"${userMsg}"`,reason:data.response},...prev])
    setLoading(false)
  }

  return (
    <div>
      {/* STATS */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[['Portfolio value','$12,841','+$1,204 today',''],
          ['Total return','+28.4%','since deployment','text-emerald-600'],
          ['Win rate','71%','last 30 trades',''],
          ['Max drawdown','-8.2%','within limit','text-red-500']
        ].map(([l,v,s,c])=>(
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className={`text-xl font-semibold ${c||'text-gray-900'}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {/* COIN CARDS — show timeframe change for selected coin, 24h for others */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {COINS.map(c => {
          const isSelected = coin === c
          const displayChange = isSelected && tfChanges[c] !== null ? tfChanges[c] : changes[c]
          const isPos = parseFloat(displayChange) >= 0
          return (
            <div key={c} onClick={() => setCoin(c)}
              className={`rounded-lg p-3 cursor-pointer border transition-all ${isSelected?'bg-white border-emerald-400 shadow-sm':'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">{c}/USDT</span>
                <span className={`text-xs font-medium ${isPos?'text-emerald-600':'text-red-500'}`}>
                  {displayChange ? `${isPos?'+':''}${displayChange}%` : '...'}
                </span>
              </div>
              <div className="text-lg font-semibold text-gray-900">${prices[c]||'...'}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">

          <ProChart coin={coin} currentPrice={prices[coin]} onTfChange={handleTfChange} />

          {/* THOUGHT LOG — manual only, no auto-scan */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Agent thought log</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                <span className="text-xs text-gray-400">ready</span>
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
              <input value={prompt} onChange={e=>setPrompt(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&sendPrompt()}
                placeholder="Ask your agent anything... e.g. 'What's your view on BTC right now?'"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400 text-gray-900 placeholder-gray-400"/>
              <button onClick={sendPrompt} disabled={loading}
                className="bg-emerald-500 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50">
                {loading ? '...' : 'Ask'}
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
            <textarea value={agentPrompt} onChange={e=>setAgentPrompt(e.target.value)}
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