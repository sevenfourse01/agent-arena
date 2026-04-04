'use client'
import { useState, useEffect } from 'react'

const COMPETITIONS = [
  {
    id: 1,
    name: 'Weekly Championship',
    description: 'Top return over 7 days takes the prize pool. All agents compete on equal footing.',
    stake: 500,
    prizePool: 48500,
    entrants: 97,
    maxEntrants: 200,
    endsIn: 4 * 24 * 60 * 60, // seconds
    tier: 'gold',
    status: 'open',
  },
  {
    id: 2,
    name: 'BTC Specialist Cup',
    description: 'BTC/USDT trades only. Best risk-adjusted return wins. Max drawdown -15% or you\'re out.',
    stake: 250,
    prizePool: 11750,
    entrants: 47,
    maxEntrants: 100,
    endsIn: 2 * 24 * 60 * 60 + 6 * 3600,
    tier: 'silver',
    status: 'open',
  },
  {
    id: 3,
    name: 'Meme Coin Madness',
    description: 'Meme coins only. Highest return wins. High risk, high reward. Not for the faint hearted.',
    stake: 100,
    prizePool: 3200,
    entrants: 32,
    maxEntrants: 50,
    endsIn: 1 * 24 * 60 * 60 + 3 * 3600,
    tier: 'bronze',
    status: 'open',
  },
  {
    id: 4,
    name: 'Beginner League',
    description: 'For agents with less than 30 days deployed. Great way to start earning $AGENT.',
    stake: 50,
    prizePool: 1800,
    entrants: 36,
    maxEntrants: 100,
    endsIn: 5 * 24 * 60 * 60,
    tier: 'beginner',
    status: 'open',
  },
]

const PAST_WINNERS = [
  { week: 'Week 12', agent: 'AlphaScalper X', owner: '@cryptowolf', ret: '+341%', prize: '32,400 $AGENT' },
  { week: 'Week 11', agent: 'MomentumBot v3', owner: '@quant_k',    ret: '+289%', prize: '28,100 $AGENT' },
  { week: 'Week 10', agent: 'SentimentEdge',  owner: '@datadave',   ret: '+241%', prize: '24,800 $AGENT' },
  { week: 'Week 9',  agent: 'VolBreaker',     owner: '@volgod',     ret: '+198%', prize: '19,200 $AGENT' },
]

const tierStyle = {
  gold:     { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',   icon: '🏆' },
  silver:   { bg: 'bg-gray-50',    border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-600',     icon: '🥈' },
  bronze:   { bg: 'bg-orange-50',  border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', icon: '🥉' },
  beginner: { bg: 'bg-blue-50',    border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',     icon: '🌱' },
}

function Countdown({ seconds }) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    const iv = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(iv)
  }, [])

  const d = Math.floor(remaining / 86400)
  const h = Math.floor((remaining % 86400) / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60

  return (
    <div className="flex gap-1.5 items-center">
      {[[d,'d'],[h,'h'],[m,'m'],[s,'s']].map(([val, unit]) => (
        <div key={unit} className="flex items-center gap-0.5">
          <span className="bg-gray-900 text-white text-xs font-mono font-bold px-1.5 py-0.5 rounded">
            {String(val).padStart(2,'0')}
          </span>
          <span className="text-xs text-gray-400">{unit}</span>
        </div>
      ))}
    </div>
  )
}

function EntryModal({ comp, onConfirm, onClose, balance }) {
  const [confirmed, setConfirmed] = useState(false)

  function handleConfirm() {
    setConfirmed(true)
    setTimeout(() => {
      onConfirm(comp.id)
      onClose()
    }, 1200)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        {confirmed ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">You're in!</h3>
            <p className="text-sm text-gray-500">Your agent has been entered into <b>{comp.name}</b>. Good luck!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{tierStyle[comp.tier].icon}</span>
              <div>
                <h3 className="text-base font-bold text-gray-900">{comp.name}</h3>
                <p className="text-xs text-gray-400">Confirm your entry</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Entry stake</span>
                <span className="font-semibold text-gray-900">{comp.stake.toLocaleString()} $AGENT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Prize pool</span>
                <span className="font-semibold text-emerald-600">{comp.prizePool.toLocaleString()} $AGENT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Current entrants</span>
                <span className="font-semibold text-gray-900">{comp.entrants}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                <span className="text-gray-500">Your balance after</span>
                <span className={`font-semibold ${balance - comp.stake < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                  {(balance - comp.stake).toLocaleString()} $AGENT
                </span>
              </div>
            </div>

            {balance < comp.stake ? (
              <div className="bg-red-50 text-red-600 text-xs rounded-lg p-3 mb-4 text-center">
                Insufficient $AGENT balance. You need {comp.stake.toLocaleString()} $AGENT to enter.
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-4 text-center">
                Your stake is added to the prize pool. Winner takes all.
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={balance < comp.stake}
                className="flex-1 bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Stake & Enter
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Competitions({ userBalance = 2400 }) {
  const [entered, setEntered] = useState([])
  const [activeModal, setActiveModal] = useState(null)
  const [balance, setBalance] = useState(userBalance)

  function handleConfirm(compId) {
    const comp = COMPETITIONS.find(c => c.id === compId)
    setEntered(prev => [...prev, compId])
    setBalance(prev => prev - comp.stake)
  }

  return (
    <div>
      {/* Header stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          ['Your balance',  `${balance.toLocaleString()}`, '$AGENT available'],
          ['Active contests', '4',   'this week'],
          ['Total prize pool','63,250','$AGENT up for grabs'],
          ['Your entries',  entered.length.toString(), entered.length === 0 ? 'enter a competition' : 'active this week'],
        ].map(([l,v,s]) => (
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className="text-xl font-semibold text-gray-900">{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {/* Active competitions */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Active Competitions</h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {COMPETITIONS.map(comp => {
          const style = tierStyle[comp.tier]
          const isEntered = entered.includes(comp.id)
          const fillPct = Math.round((comp.entrants / comp.maxEntrants) * 100)

          return (
            <div key={comp.id}
              className={`rounded-xl border p-4 ${style.bg} ${style.border} ${isEntered ? 'ring-2 ring-emerald-400' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{style.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{comp.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
                      {comp.stake.toLocaleString()} $AGENT stake
                    </span>
                  </div>
                </div>
                {isEntered && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">✓ Entered</span>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{comp.description}</p>

              {/* Prize pool */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Prize pool</span>
                <span className="text-sm font-bold text-emerald-600">{comp.prizePool.toLocaleString()} $AGENT</span>
              </div>

              {/* Entrants bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{comp.entrants} entered</span>
                  <span>{comp.maxEntrants} max</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${fillPct}%` }} />
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-400">Ends in</span>
                <Countdown seconds={comp.endsIn} />
              </div>

              <button
                onClick={() => !isEntered && setActiveModal(comp)}
                disabled={isEntered}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isEntered
                    ? 'bg-emerald-100 text-emerald-700 cursor-default'
                    : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}>
                {isEntered ? '✓ Entered' : `Enter for ${comp.stake.toLocaleString()} $AGENT`}
              </button>
            </div>
          )
        })}
      </div>

      {/* Past winners */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Past Winners</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium border-b border-gray-200">
          <div>Week</div>
          <div className="col-span-2">Agent</div>
          <div className="text-right">Return</div>
          <div className="text-right">Prize won</div>
        </div>
        {PAST_WINNERS.map((w, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 px-4 py-3 border-t border-gray-100 items-center hover:bg-gray-50">
            <div className="text-xs text-gray-500">{w.week}</div>
            <div className="col-span-2">
              <div className="text-sm font-semibold text-gray-900">{w.agent}</div>
              <div className="text-xs text-gray-400">{w.owner}</div>
            </div>
            <div className="text-sm font-semibold text-emerald-600 text-right">{w.ret}</div>
            <div className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-right w-fit ml-auto">{w.prize}</div>
          </div>
        ))}
      </div>

      {/* Entry modal */}
      {activeModal && (
        <EntryModal
          comp={activeModal}
          balance={balance}
          onConfirm={handleConfirm}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}