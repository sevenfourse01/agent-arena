export default function History() {
  const trades = [
    { time:'14:32 today', pair:'BTC', side:'BUY', entry:'$43,820', exit:'open', pnl:'+$420', up:true, reason:'MACD bullish cross + positive sentiment' },
    { time:'11:14 today', pair:'SOL', side:'SELL', entry:'$141.20', exit:'$138.40', pnl:'-$182', up:false, reason:'Stop-loss hit — support broken on high volume' },
    { time:'09:02 today', pair:'ETH', side:'BUY', entry:'$3,180', exit:'$3,290', pnl:'+$154', up:true, reason:'RSI oversold bounce + MA50 holding support' },
    { time:'Yesterday', pair:'BTC', side:'SELL', entry:'$42,100', exit:'$43,800', pnl:'+$476', up:true, reason:'Take-profit hit — 1:3 RR achieved' },
    { time:'Yesterday', pair:'AGENT', side:'BUY', entry:'$0.038', exit:'$0.041', pnl:'+$74', up:true, reason:'Volume breakout from consolidation' },
    { time:'2 days ago', pair:'ETH', side:'SELL', entry:'$3,310', exit:'$3,280', pnl:'-$42', up:false, reason:'Negative news spike — FUD detected, reduced exposure' },
  ]
  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[['Total trades','84','last 30 days'],['Win rate','71%','60 of 84 profitable'],['Total P&L','+$2,841','realised'],['Avg hold','4.2h','per trade']].map(([l,v,s])=>(
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className="text-xl font-medium">{v}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium">
          <div>Time</div><div>Pair</div><div>Side</div><div className="text-right">Entry</div><div className="text-right">Exit</div><div className="text-right">P&L</div>
        </div>
        {trades.map((t,i)=>(
          <div key={i} className="px-4 py-3 border-t border-gray-100">
            <div className="grid grid-cols-6 gap-2 items-center mb-1">
              <div className="text-xs text-gray-400">{t.time}</div>
              <div className="text-xs font-medium">{t.pair}</div>
              <div><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.side==='BUY'?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-700'}`}>{t.side}</span></div>
              <div className="text-xs text-right">{t.entry}</div>
              <div className="text-xs text-right text-gray-400">{t.exit}</div>
              <div className={`text-xs font-medium text-right ${t.up?'text-emerald-600':'text-red-500'}`}>{t.pnl}</div>
            </div>
            <div className="text-xs text-gray-400 mt-1">{t.reason}</div>
          </div>
        ))}
      </div>
    </div>
  )
}