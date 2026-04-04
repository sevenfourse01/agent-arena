'use client'
import { useState, useEffect } from 'react'

const TIMEFRAMES = [
  { label: '1H',  limit: 60,  msPerCandle: 60000    },
  { label: '4H',  limit: 48,  msPerCandle: 300000   },
  { label: '24H', limit: 96,  msPerCandle: 900000   },
  { label: '7D',  limit: 168, msPerCandle: 3600000  },
  { label: '1M',  limit: 180, msPerCandle: 14400000 },
]

const CHART_TYPES = [
  { id: 'candles',        label: 'Candles'            },
  { id: 'hollow_candles', label: 'Hollow Candles'     },
  { id: 'bars',           label: 'Bars'               },
  { id: 'line',           label: 'Line'               },
  { id: 'line_markers',   label: 'Line with Markers'  },
  { id: 'step_line',      label: 'Step Line'          },
  { id: 'area',           label: 'Area'               },
  { id: 'hlc_area',       label: 'HLC Area'           },
  { id: 'baseline',       label: 'Baseline'           },
  { id: 'columns',        label: 'Columns'            },
  { id: 'high_low',       label: 'High-Low'           },
]

const TOP_TRADERS = [
  { rank:1, name:'AlphaScalper X',   owner:'@cryptowolf', pnl:'+$48,420', ret:'+341%', trades:142, isBot:true        },
  { rank:2, name:'MomentumBot v3',   owner:'@quant_k',    pnl:'+$31,200', ret:'+289%', trades:98,  isBot:true        },
  { rank:3, name:'SentimentEdge',    owner:'@datadave',   pnl:'+$24,100', ret:'+241%', trades:87,  isBot:true        },
  { rank:4, name:'cryptowolf',       owner:'@cryptowolf', pnl:'+$18,900', ret:'+198%', trades:203, isBot:false       },
  { rank:5, name:'NeuralTrader Pro', owner:'@nn_trades',  pnl:'+$14,200', ret:'+176%', trades:76,  isBot:true        },
  { rank:6, name:'volgod',           owner:'@volgod',     pnl:'+$11,800', ret:'+154%', trades:311, isBot:false       },
  { rank:7, name:'RSIHunter',        owner:'@rsi_king',   pnl:'+$9,400',  ret:'+143%', trades:64,  isBot:true        },
  { rank:8, name:'Your agent',       owner:'@you',        pnl:'+$2,100',  ret:'+28%',  trades:12,  isBot:true, isYou:true },
]

function generateCandles(count, msPerCandle) {
  const candles = []
  let price = 0.0380
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    const open = price
    const change = (Math.random() - 0.47) * 0.0007 + 0.00002
    price = Math.max(0.020, price + change)
    const close = price
    const high = Math.max(open, close) + Math.random() * 0.0003
    const low  = Math.max(0.020, Math.min(open, close) - Math.random() * 0.0003)
    candles.push({ t: now - (count - i) * msPerCandle, o: open, h: high, l: low, c: close })
  }
  return candles
}

function generateTrades(count) {
  const trades = []
  const now = Date.now()
  let price = 0.0421
  const agents = ['AlphaScalper X','MomentumBot v3','cryptowolf','SentimentEdge','NeuralTrader Pro','volgod','RSIHunter','WhaleWatcher']
  for (let i = 0; i < count; i++) {
    price = Math.max(0.020, price + (Math.random() - 0.48) * 0.0003)
    const amount = Math.floor(Math.random() * 80000 + 2000)
    trades.push({
      time:   new Date(now - i * (Math.random() * 240000 + 20000)),
      type:   Math.random() > 0.44 ? 'BUY' : 'SELL',
      price,
      amount,
      total:  amount * price,
      mc:     price * 1_000_000_000,
      agent:  agents[Math.floor(Math.random() * agents.length)],
    })
  }
  return trades
}

function formatPrice(n) {
  if (!n && n !== 0) return '...'
  if (n >= 1) return '$' + n.toFixed(4)
  return '$' + n.toFixed(6)
}

function formatNum(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}

function renderChartContent(type, candles, toX, toY, padL, padT, chartW, chartH) {
  if (!candles.length) return null
  const n = candles.length
  const closes = candles.map(c => c.c)
  const highs  = candles.map(c => c.h)
  const lows   = candles.map(c => c.l)
  const cw     = Math.max(1.5, Math.min(10, chartW / n * 0.7))
  const up     = '#10b981', dn = '#ef4444'
  const isUp   = i => candles[i].c >= candles[i].o
  const col    = i => isUp(i) ? up : dn

  const linePath = closes.map((c,i) => `${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(c).toFixed(1)}`).join(' ')
  const overallUp = closes[n-1] >= closes[0]
  const lineColor = overallUp ? up : dn

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
        <clipPath id="aboveBase"><rect x={padL} y={padT} width={chartW} height={Math.max(0, baseY-padT)}/></clipPath>
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

export default function AgentCoin() {
  const [tf, setTf]               = useState(TIMEFRAMES[2])
  const [chartType, setChartType] = useState('candles')
  const [candles, setCandles]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [hovIdx, setHovIdx]       = useState(null)
  const [showMenu, setShowMenu]   = useState(false)
  const [trades]                  = useState(() => generateTrades(60))
  const [price, setPrice]         = useState(0.0421)

  useEffect(() => {
    setLoading(true); setCandles([])
    const t = setTimeout(() => { setCandles(generateCandles(tf.limit, tf.msPerCandle)); setLoading(false) }, 300)
    return () => clearTimeout(t)
  }, [tf])

  useEffect(() => {
    const iv = setInterval(() => setPrice(p => Math.max(0.02, p + (Math.random()-0.48)*0.0002)), 2000)
    return () => clearInterval(iv)
  }, [])

  const W=820, H=320, padL=75, padR=10, padT=15, padB=35
  const chartW=W-padL-padR, chartH=H-padT-padB

  const lows   = candles.map(c=>c.l)
  const highs  = candles.map(c=>c.h)
  const closes = candles.map(c=>c.c)
  const minP   = candles.length ? Math.min(...lows)*0.999  : 0
  const maxP   = candles.length ? Math.max(...highs)*1.001 : 1
  const range  = maxP-minP||1

  const toX = i => padL + (i/Math.max(candles.length-1,1))*chartW
  const toY = p => padT + chartH - ((p-minP)/range)*chartH

  const yTicks = Array.from({length:6},(_,i)=>minP+(range*i)/5)
  const xStep  = Math.max(1,Math.floor(candles.length/6))
  const xTicks = candles.map((c,i)=>({c,i})).filter(({i})=>i%xStep===0)
  const hovCandle = hovIdx!==null ? candles[hovIdx] : null

  function xLabel(ts) {
    const d = new Date(ts)
    if (tf.label==='7D'||tf.label==='1M') return d.toUTCString().slice(5,11)
    return d.toUTCString().slice(17,22) + ' UTC'
  }

  const rankColor = r => r===1?'text-amber-500 font-bold':r===2?'text-gray-400 font-bold':r===3?'text-orange-500 font-bold':'text-gray-400'
  const rankIcon  = r => r===1?'🥇':r===2?'🥈':r===3?'🥉':null
  const currentLabel = CHART_TYPES.find(t=>t.id===chartType)?.label

  return (
    <div>
      {/* Hero */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xl">A</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">$AGENT</h1>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">Solana</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Agent Arena</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-900">{formatPrice(price)}</span>
                <span className="text-sm font-semibold text-emerald-600">+12.4% today</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="https://axiom.trade" target="_blank" rel="noopener noreferrer"
              className="bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors">
              View on Axiom →
            </a>
            <a href="https://axiom.trade" target="_blank" rel="noopener noreferrer"
              className="bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-emerald-600 transition-colors">
              Trade $AGENT →
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[['Market cap','$4,210,000','fully diluted'],['24h volume','$2,841,200','traded today'],['Holders','3,214','unique wallets'],['Total supply','1,000,000,000','$AGENT minted']].map(([l,v,s])=>(
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className="text-xl font-semibold text-gray-900">{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">$AGENT / USD</span>
            {hovCandle && (
              <span className="text-xs text-gray-500">
                O:<b className="text-gray-800"> {formatPrice(hovCandle.o)}</b>&nbsp;
                H:<b className="text-gray-800"> {formatPrice(hovCandle.h)}</b>&nbsp;
                L:<b className="text-gray-800"> {formatPrice(hovCandle.l)}</b>&nbsp;
                C:<b className="text-gray-800"> {formatPrice(hovCandle.c)}</b>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Chart type dropdown */}
            <div className="relative">
              <button onClick={() => setShowMenu(m=>!m)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 font-medium flex items-center gap-1.5 hover:bg-gray-100 whitespace-nowrap">
                {currentLabel} <span className="text-gray-400">▾</span>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-xl z-30 w-48 py-1 overflow-hidden">
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
              {TIMEFRAMES.map(t=>(
                <button key={t.label} onClick={()=>setTf(t)}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${tf.label===t.label?'bg-emerald-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden bg-gray-50 relative" onClick={()=>setShowMenu(false)}>
          {loading && <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 bg-gray-50 z-10">Loading...</div>}
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{height:'300px',cursor:'crosshair',display:'block'}}
            onMouseLeave={()=>setHovIdx(null)}
            onMouseMove={e=>{
              if(!candles.length) return
              const rect=e.currentTarget.getBoundingClientRect()
              const mx=((e.clientX-rect.left)/rect.width)*W
              const idx=Math.round(((mx-padL)/chartW)*(candles.length-1))
              setHovIdx(Math.max(0,Math.min(candles.length-1,idx)))
            }}>
            {/* Grid */}
            {yTicks.map((p,i)=>(
              <line key={i} x1={padL} y1={toY(p).toFixed(1)} x2={padL+chartW} y2={toY(p).toFixed(1)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4"/>
            ))}
            {/* Chart */}
            {candles.length>0 && renderChartContent(chartType,candles,toX,toY,padL,padT,chartW,chartH)}
            {/* Crosshair */}
            {hovIdx!==null && hovCandle && (<>
              <line x1={toX(hovIdx).toFixed(1)} y1={padT} x2={toX(hovIdx).toFixed(1)} y2={padT+chartH} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3"/>
              <line x1={padL} y1={toY(hovCandle.c).toFixed(1)} x2={padL+chartW} y2={toY(hovCandle.c).toFixed(1)} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3"/>
              <circle cx={toX(hovIdx).toFixed(1)} cy={toY(hovCandle.c).toFixed(1)} r="4" fill="#374151" stroke="white" strokeWidth="1.5"/>
              <rect x={0} y={toY(hovCandle.c)-10} width={padL-2} height={20} rx="3" fill="#374151"/>
              <text x={(padL-2)/2} y={toY(hovCandle.c)+4.5} textAnchor="middle" fontSize="9.5" fill="white" fontWeight="700">{formatPrice(hovCandle.c)}</text>
            </>)}
            {/* Y axis */}
            {yTicks.map((p,i)=>(
              <text key={i} x={padL-5} y={toY(p)+4} fontSize="9" fill="#6b7280" textAnchor="end">{formatPrice(p)}</text>
            ))}
            <line x1={padL} y1={padT} x2={padL} y2={padT+chartH} stroke="#d1d5db" strokeWidth="1"/>
            <line x1={padL} y1={padT+chartH} x2={padL+chartW} y2={padT+chartH} stroke="#d1d5db" strokeWidth="1"/>
            {/* X axis */}
            {xTicks.map(({c,i})=>(
              <text key={i} x={toX(i)} y={padT+chartH+22} fontSize="9" fill="#9ca3af" textAnchor="middle">{xLabel(c.t)}</text>
            ))}
          </svg>
        </div>
      </div>

      {/* Traders + About */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Top $AGENT traders</div>
          {TOP_TRADERS.map((t,i)=>(
            <div key={i} className={`flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 ${t.isYou?'bg-blue-50 -mx-4 px-4':''}`}>
              <div className="flex items-center gap-2">
                <div className={`text-sm w-5 text-center ${rankColor(t.rank)}`}>{rankIcon(t.rank)?<span>{rankIcon(t.rank)}</span>:t.rank}</div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-900">{t.name}</span>
                    <span className={`text-xs px-1 rounded ${t.isBot?'bg-purple-50 text-purple-600':'bg-blue-50 text-blue-600'}`}>{t.isBot?'🤖':'👤'}</span>
                  </div>
                  <div className="text-xs text-gray-400">{t.trades} trades</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-600">{t.ret}</div>
                <div className="text-xs text-gray-500">{t.pnl}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">About $AGENT</div>
          <p className="text-xs text-gray-600 leading-relaxed mb-4">
            $AGENT is the native utility token of the Agent Arena ecosystem on Solana. It powers competition entry stakes, agent copying, leaderboard rewards, and platform governance. The more agents compete, the more $AGENT circulates.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[['Network','Solana'],['Token type','SPL Token'],['Listed on','Axiom'],['Use cases','Staking · Competitions · Copies'],['Max supply','1,000,000,000 $AGENT'],['Circulating','420,000,000 $AGENT']].map(([l,v])=>(
              <div key={l} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-0.5">{l}</div>
                <div className="text-xs font-semibold text-gray-900">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trade history table */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-900">All trades</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
            <span className="text-xs text-gray-400">live</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {['Time (GMT)','Type','Price','Amount ($AGENT)','Total (USD)','Mkt Cap','Agent'].map(h=>(
                  <th key={h} className="text-left text-xs text-gray-400 font-medium pb-2.5 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t,i)=>(
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-4 text-xs text-gray-500 font-mono whitespace-nowrap">{t.time.toUTCString().slice(0,25)}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.type==='BUY'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{t.type}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs font-medium text-gray-800 font-mono">{formatPrice(t.price)}</td>
                  <td className="py-2.5 pr-4 text-xs text-gray-700">{t.amount.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-xs font-semibold text-gray-900">{formatNum(t.total)}</td>
                  <td className="py-2.5 pr-4 text-xs text-gray-500">{formatNum(t.mc)}</td>
                  <td className="py-2.5 pr-4 text-xs text-gray-500">{t.agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}