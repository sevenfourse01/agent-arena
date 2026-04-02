'use client'
import { useState, useRef } from 'react'

const COINS = ['BTC', 'ETH', 'SOL', 'AGENT', 'BNB']

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
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-800',
  blue: 'bg-blue-50 text-blue-800',
  purple: 'bg-purple-50 text-purple-800',
}

export default function Cockpit() {
  const [coin, setCoin] = useState('BTC')
  const [log, setLog] = useState(seedLog)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
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

  async function sendPrompt() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    const userMsg = prompt
    setPrompt('')
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInstruction: userMsg, agentPrompt })
    })
    const data = await res.json()
    const now = new Date()
    const t = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
    setLog(prev => [{
      color: 'purple', label: 'You instructed', time: t,
      msg: `"${userMsg}"`,
      reason: data.response
    }, ...prev])
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
            <div className={`text-xl font-medium ${c}`}>{v}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Live chart</span>
              <span className="text-xs text-gray-400">{coin}/USDT · 1h</span>
            </div>
            <div className="flex gap-2 mb-3">
              {COINS.map(c => (
                <button key={c} onClick={() => setCoin(c)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${coin===c ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="bg-gray-50 rounded-lg h-44">
              <svg viewBox="0 0 500 120" className="w-full h-36">
                <polyline points="0,90 40,82 80,95 120,72 160,68 200,78 240,55 280,50 320,60 360,42 400,46 440,34 480,38 500,28"
                  fill="none" stroke="#10b981" strokeWidth="2"/>
                <polyline points="0,90 40,82 80,95 120,72 160,68 200,78 240,55 280,50 320,60 360,42 400,46 440,34 480,38 500,28 500,120 0,120"
                  fill="#d1fae5" opacity="0.5"/>
                <line x1="240" y1="0" x2="240" y2="120" stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"/>
                <text x="243" y="12" fontSize="8" fill="#059669">BUY</text>
                <line x1="400" y1="0" x2="400" y2="120" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"/>
                <text x="403" y="12" fontSize="8" fill="#dc2626">SELL</text>
              </svg>
            </div>
            <div className="flex gap-2 flex-wrap mt-3">
              {[['RSI 54 — neutral','emerald'],['MACD bullish cross','emerald'],['MA50 > MA200','emerald'],['Volume avg','gray'],['Sentiment: mixed','red']].map(([l,c])=>(
                <span key={l} className={`text-xs px-2 py-0.5 rounded-full font-medium ${c==='emerald'?'bg-emerald-50 text-emerald-800':c==='red'?'bg-red-50 text-red-700':'bg-gray-100 text-gray-500'}`}>{l}</span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Agent thought log</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                <span className="text-xs text-gray-400">live</span>
              </div>
            </div>
            <div className="flex flex-col gap-0 max-h-72 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i} className="py-2.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[entry.color]}`}>{entry.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{entry.time}</span>
                  </div>
                  <p className="text-xs text-gray-700 mb-1">{entry.msg}</p>
                  <p className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1.5 leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <input value={prompt} onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendPrompt()}
                placeholder="Tell the agent something... e.g. 'Be more aggressive on BTC'"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400"/>
              <button onClick={sendPrompt} disabled={loading}
                className="bg-emerald-500 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50">
                {loading ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-medium mb-3">Open positions</div>
            {[['BTC/USDT','0.28 BTC · $43,820','+$420 +3.1%','text-emerald-600'],
              ['ETH/USDT','1.4 ETH · $3,210','+$218 +1.8%','text-emerald-600'],
              ['$AGENT/USDT','1,240 · $0.042','-$44 -0.9%','text-red-500']
            ].map(([pair,det,pnl,c])=>(
              <div key={pair} className="py-2.5 border-b border-gray-100 last:border-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs font-medium">{pair}</span>
                  <span className={`text-xs font-medium ${c}`}>{pnl}</span>
                </div>
                <span className="text-xs text-gray-400">{det}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-medium mb-2">Agent prompt</div>
            <textarea value={agentPrompt} onChange={e => setAgentPrompt(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 resize-none h-40 font-mono focus:outline-none focus:border-emerald-400"/>
            <button className="w-full mt-2 bg-emerald-500 text-white text-xs font-medium py-2 rounded-lg">
              Save and redeploy agent
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-medium mb-3">Signal sources</div>
            {['Price action (OHLCV)','RSI / MACD / MAs','News sentiment','Social (X / Reddit)','On-chain volume'].map((s,i)=>(
              <div key={s} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-600">{s}</span>
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