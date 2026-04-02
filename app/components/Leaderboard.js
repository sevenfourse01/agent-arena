export default function Leaderboard() {
  const agents = [
    { rank:1, name:'AlphaScalper X', owner:'@cryptowolf', ret:'+341%', win:'78%', dd:'-8%', copies:912, earned:'8,400' },
    { rank:2, name:'MomentumBot v3', owner:'@quant_k', ret:'+289%', win:'71%', dd:'-14%', copies:703, earned:'5,200' },
    { rank:3, name:'SentimentEdge', owner:'@datadave', ret:'+241%', win:'68%', dd:'-19%', copies:541, earned:'3,100' },
    { rank:31, name:'Your agent', owner:'@you', ret:'+28%', win:'71%', dd:'-8%', copies:12, earned:'420', isYou:true },
    { rank:4, name:'VolBreaker', owner:'@volgod', ret:'+198%', win:'64%', dd:'-22%', copies:388, earned:'' },
    { rank:5, name:'GridMaster', owner:'@grid_g', ret:'-12%', win:'41%', dd:'-31%', copies:201, earned:'' },
  ]
  const rankColor = (r) => r===1?'text-amber-600 font-medium':r===2?'text-gray-400 font-medium':r===3?'text-orange-600 font-medium':'text-gray-400'
  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[['Your rank','#31','of 3,214 agents'],['Your return','+28.4%','this week'],['Copies of you','12','420 $AGENT earned'],['Prize pool','80k','$AGENT this week']].map(([l,v,s])=>(
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className="text-xl font-medium">{v}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium">
          <div>#</div><div className="col-span-2">Agent</div><div className="text-right">Return</div><div className="text-right">Win rate</div><div className="text-right">Copies</div><div className="text-right"></div>
        </div>
        {agents.map((a) => (
          <div key={a.rank} className={`grid grid-cols-7 gap-2 px-4 py-3 border-t border-gray-100 items-center ${a.isYou?'bg-blue-50':''}`}>
            <div className={`text-sm ${rankColor(a.rank)}`}>{a.rank}</div>
            <div className="col-span-2">
              <div className="text-sm font-medium">{a.name}</div>
              <div className="text-xs text-gray-400">{a.owner}{a.earned&&<span className="ml-1 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full text-xs">+{a.earned} $AGENT</span>}</div>
            </div>
            <div className={`text-sm font-medium text-right ${a.ret.startsWith('+')?'text-emerald-600':'text-red-500'}`}>{a.ret}</div>
            <div className="text-sm text-right">{a.win}</div>
            <div className="text-sm text-right">{a.copies}</div>
            <div className="text-right">{!a.isYou&&<button className="bg-emerald-50 text-emerald-800 text-xs font-medium px-2.5 py-1 rounded-full">1-click copy</button>}</div>
          </div>
        ))}
      </div>
    </div>
  )
}