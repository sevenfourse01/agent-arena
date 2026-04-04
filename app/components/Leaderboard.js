export default function Leaderboard() {
  const agents = [
    { rank:1,  name:'AlphaScalper X',     owner:'@cryptowolf',   ret:'+341%', win:'78%', dd:'-8%',   copies:912, earned:'8,400' },
    { rank:2,  name:'MomentumBot v3',      owner:'@quant_k',      ret:'+289%', win:'71%', dd:'-14%',  copies:703, earned:'5,200' },
    { rank:3,  name:'SentimentEdge',       owner:'@datadave',     ret:'+241%', win:'68%', dd:'-19%',  copies:541, earned:'3,100' },
    { rank:4,  name:'VolBreaker',          owner:'@volgod',       ret:'+198%', win:'64%', dd:'-22%',  copies:388, earned:'2,800' },
    { rank:5,  name:'NeuralTrader Pro',    owner:'@nn_trades',    ret:'+176%', win:'66%', dd:'-11%',  copies:344, earned:'2,400' },
    { rank:6,  name:'RSIHunter',           owner:'@rsi_king',     ret:'+154%', win:'62%', dd:'-17%',  copies:291, earned:'1,900' },
    { rank:7,  name:'MACDPulse',           owner:'@signalflow',   ret:'+143%', win:'61%', dd:'-20%',  copies:267, earned:'1,700' },
    { rank:8,  name:'WhaleWatcher',        owner:'@on_chain_g',   ret:'+131%', win:'59%', dd:'-15%',  copies:243, earned:'1,500' },
    { rank:9,  name:'TrendRider AI',       owner:'@trendhunter',  ret:'+119%', win:'57%', dd:'-24%',  copies:218, earned:'1,200' },
    { rank:10, name:'LiquiditySniper',     owner:'@liq_snap',     ret:'+108%', win:'56%', dd:'-18%',  copies:197, earned:'1,100' },
    { rank:11, name:'BitPredator',         owner:'@bitpred',      ret:'+97%',  win:'55%', dd:'-21%',  copies:176, earned:'980'   },
    { rank:12, name:'FundingRateBot',      owner:'@fundflow',     ret:'+89%',  win:'54%', dd:'-16%',  copies:162, earned:'870'   },
    { rank:13, name:'BreakoutKing',        owner:'@brkout_k',     ret:'+82%',  win:'53%', dd:'-25%',  copies:148, earned:'760'   },
    { rank:14, name:'OrderFlowAI',         owner:'@orderflow',    ret:'+74%',  win:'52%', dd:'-19%',  copies:134, earned:'640'   },
    { rank:15, name:'EthMaximalist',       owner:'@eth_maxi',     ret:'+68%',  win:'51%', dd:'-27%',  copies:119, earned:'530'   },
    { rank:16, name:'SolanaSpeed',         owner:'@solspeed',     ret:'+61%',  win:'50%', dd:'-22%',  copies:104, earned:'480'   },
    { rank:17, name:'GridMaster Plus',     owner:'@grid_g',       ret:'+54%',  win:'49%', dd:'-29%',  copies:91,  earned:'410'   },
    { rank:18, name:'DeltaNeutral',        owner:'@delta_n',      ret:'+47%',  win:'48%', dd:'-13%',  copies:83,  earned:'370'   },
    { rank:19, name:'ScalpBot 9000',       owner:'@scalpfast',    ret:'+41%',  win:'47%', dd:'-31%',  copies:74,  earned:'310'   },
    { rank:20, name:'MacroEdge',           owner:'@macro_m',      ret:'+38%',  win:'46%', dd:'-20%',  copies:68,  earned:'280'   },
    { rank:21, name:'AltCoinChaser',       owner:'@altseason',    ret:'+33%',  win:'45%', dd:'-33%',  copies:59,  earned:'240'   },
    { rank:22, name:'MEVBot Alpha',        owner:'@mev_alpha',    ret:'+31%',  win:'44%', dd:'-18%',  copies:51,  earned:'210'   },
    { rank:23, name:'SentimentSurf',       owner:'@senti_surf',   ret:'+29%',  win:'43%', dd:'-26%',  copies:44,  earned:'190'   },
    { rank:24, name:'ChainAnalyser',       owner:'@chain_a',      ret:'+29%',  win:'43%', dd:'-22%',  copies:38,  earned:'170'   },
    { rank:25, name:'SmartMoneyAI',        owner:'@smartm',       ret:'+28%',  win:'42%', dd:'-28%',  copies:31,  earned:'150'   },
    { rank:31, name:'Your agent',          owner:'@you',          ret:'+28%',  win:'71%', dd:'-8%',   copies:12,  earned:'420',  isYou:true },
    { rank:26, name:'BTCMaxBot',           owner:'@btcmax',       ret:'+21%',  win:'41%', dd:'-30%',  copies:27,  earned:''      },
    { rank:27, name:'DegenTrader',         owner:'@degen_d',      ret:'+14%',  win:'39%', dd:'-38%',  copies:19,  earned:''      },
    { rank:28, name:'CopyKing',            owner:'@copytrade',    ret:'+9%',   win:'37%', dd:'-35%',  copies:14,  earned:''      },
    { rank:29, name:'HighFreqX',           owner:'@hfx_bot',      ret:'-4%',   win:'44%', dd:'-29%',  copies:11,  earned:''      },
    { rank:30, name:'LeverageMax',         owner:'@lev_max',      ret:'-12%',  win:'41%', dd:'-41%',  copies:8,   earned:''      },
  ]

  const rankColor = (r) =>
    r === 1 ? 'text-amber-500 font-bold' :
    r === 2 ? 'text-gray-400 font-bold' :
    r === 3 ? 'text-orange-500 font-bold' :
    'text-gray-400'

  const rankIcon = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          ['Your rank',    '#31',   'of 3,214 agents'],
          ['Your return',  '+28.4%','this week'],
          ['Copies of you','12',    '420 $AGENT earned'],
          ['Prize pool',   '80k',   '$AGENT this week'],
        ].map(([l,v,s]) => (
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className="text-xl font-semibold text-gray-900">{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium border-b border-gray-200">
          <div>#</div>
          <div className="col-span-2">Agent</div>
          <div className="text-right">Return</div>
          <div className="text-right">Win rate</div>
          <div className="text-right">Copies</div>
          <div className="text-right"></div>
        </div>

        {agents.map((a) => (
          <div key={a.rank}
            className={`grid grid-cols-7 gap-2 px-4 py-3 border-t border-gray-100 items-center hover:bg-gray-50 transition-colors ${a.isYou ? 'bg-blue-50 hover:bg-blue-50' : ''}`}>

            {/* Rank */}
            <div className={`text-sm ${rankColor(a.rank)}`}>
              {rankIcon(a.rank) ? <span className="text-base">{rankIcon(a.rank)}</span> : a.rank}
            </div>

            {/* Name + owner */}
            <div className="col-span-2">
              <div className="text-sm font-semibold text-gray-900">{a.name}</div>
              <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                {a.owner}
                {a.earned && (
                  <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full text-xs font-medium">
                    +{a.earned} $AGENT
                  </span>
                )}
              </div>
            </div>

            {/* Return */}
            <div className={`text-sm font-semibold text-right ${a.ret.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>
              {a.ret}
            </div>

            {/* Win rate */}
            <div className="text-sm text-gray-700 text-right">{a.win}</div>

            {/* Copies */}
            <div className="text-sm text-gray-700 text-right">{a.copies.toLocaleString()}</div>

            {/* Action */}
            <div className="text-right">
              {a.isYou ? (
                <span className="text-xs text-blue-500 font-medium">← you</span>
              ) : (
                <button className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
                  Copy
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-gray-400 mt-3">
        Showing top 30 of 3,214 agents · Updated every 60 seconds
      </div>
    </div>
  )
}