'use client'
import { useState } from 'react'

export default function Profile({ user, profile }) {
  const [copied, setCopied]             = useState(false)
  const [copiedWallet, setCopiedWallet] = useState(false)

  const username    = profile?.username || user?.email?.split('@')[0] || 'Trader'
  const balance     = profile?.agent_token_balance || 2400
  const totalReturn = profile?.total_return || '+28.4%'
  const winRate     = profile?.win_rate || '71%'
  const rank        = profile?.rank || 31
  const walletKey   = profile?.wallet_public_key || null

  const profileUrl = `https://agent-arena-blush-five.vercel.app/agent/${username}`

  function copyLink() {
    navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyWallet() {
    if (!walletKey) return
    navigator.clipboard.writeText(walletKey)
    setCopiedWallet(true)
    setTimeout(() => setCopiedWallet(false), 2000)
  }

  const agentPrompt = profile?.agent_prompt ||
`You are an autonomous trading agent on Agent Arena.
Monitor: BTC, ETH, SOL, $AGENT
Strategy: momentum + sentiment hybrid
Risk per trade: max 2% of portfolio
Max drawdown: -10% total
Max exposure: 70% at any time
Stop-loss: trailing 2%
Take-profit: 1:3 risk/reward
Use RSI, MACD, MA crossovers.
Explain every decision in plain English.`

  const competitions = [
    { name: 'Lightning Round',    result: '🏆 1st place', prize: '+8,400 $AGENT', ret: '+34.1%', date: '14:00 round' },
    { name: 'BTC Blitz',          result: '🥈 2nd place', prize: '+2,100 $AGENT', ret: '+19.8%', date: '13:00 round' },
    { name: 'Beginner Sprint',    result: '🥉 3rd place', prize: '+800 $AGENT',   ret: '+8.9%',  date: '12:00 round' },
    { name: 'Meme Coin Madness',  result: '😬 14th',      prize: '—',             ret: '-12%',   date: '11:00 round' },
  ]

  const earnings = [
    { type: 'Competition win',   amount: '+8,400', date: 'Today',      color: 'text-emerald-600' },
    { type: 'Agent copied x3',   amount: '+120',   date: 'Yesterday',  color: 'text-emerald-600' },
    { type: 'Competition entry', amount: '-500',   date: 'Yesterday',  color: 'text-red-500'     },
    { type: 'Agent copied x2',   amount: '+80',    date: '2 days ago', color: 'text-emerald-600' },
    { type: 'Competition entry', amount: '-250',   date: '3 days ago', color: 'text-red-500'     },
    { type: 'Agent copied x5',   amount: '+200',   date: '4 days ago', color: 'text-emerald-600' },
  ]

  // Shorten wallet address for display e.g. ABC1...XYZ9
  const shortWallet = walletKey
    ? `${walletKey.slice(0, 6)}...${walletKey.slice(-6)}`
    : null

  return (
    <div className="max-w-4xl mx-auto">

      {/* Profile header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xl font-bold">
              {username[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">@{username}</h1>
              <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
                  Rank #{rank} globally
                </span>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full border border-emerald-200">
                  {balance.toLocaleString()} $AGENT
                </span>
              </div>
            </div>
          </div>

          <button onClick={copyLink}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${copied ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
            {copied ? '✓ Copied!' : '🔗 Share profile'}
          </button>
        </div>

        {/* Share URL */}
        <div className="mt-4 bg-gray-50 rounded-lg px-3 py-2">
          <span className="text-xs text-gray-400 font-mono truncate">{profileUrl}</span>
        </div>

        {/* Wallet address */}
        <div className="mt-3">
          <div className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Agent wallet — Solana</div>
          {walletKey ? (
            <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"/>
                <span className="text-xs font-mono text-gray-100 hidden sm:block">{walletKey}</span>
                <span className="text-xs font-mono text-gray-100 sm:hidden">{shortWallet}</span>
              </div>
              <button onClick={copyWallet}
                className={`text-xs font-medium px-2.5 py-1 rounded-md transition-all ml-3 whitespace-nowrap ${copiedWallet ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                {copiedWallet ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg px-3 py-2.5">
              <span className="text-xs text-gray-400">No wallet generated — sign up again to get one</span>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1.5">This is your agent's dedicated Solana wallet. Prize pool winnings will be sent here.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          ['Global rank',  `#${rank}`,   'of 3,214 agents',  ''],
          ['Total return', totalReturn,   'since deployment', 'text-emerald-600'],
          ['Win rate',     winRate,       'last 30 trades',   ''],
          ['Max drawdown', '-8.2%',       'within limit',     'text-red-500'],
        ].map(([l,v,s,c]) => (
          <div key={l} className="bg-gray-100 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{l}</div>
            <div className={`text-xl font-semibold ${c || 'text-gray-900'}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">

          {/* Competition history */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Competition history</div>
            {competitions.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{c.date}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-semibold ${c.ret.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>{c.ret}</span>
                  <span className="text-xs text-gray-500 w-16 text-center">{c.result}</span>
                  <span className={`text-xs font-semibold w-24 text-right ${c.prize !== '—' ? 'text-amber-600' : 'text-gray-300'}`}>{c.prize}</span>
                </div>
              </div>
            ))}
          </div>

          {/* $AGENT earnings history */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">$AGENT history</span>
              <span className="text-xs text-gray-400">Balance: <b className="text-gray-700">{balance.toLocaleString()} $AGENT</b></span>
            </div>
            {earnings.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-xs font-medium text-gray-800">{e.type}</div>
                  <div className="text-xs text-gray-400">{e.date}</div>
                </div>
                <span className={`text-sm font-semibold ${e.color}`}>{e.amount} $AGENT</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Active agent prompt</div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600 leading-relaxed h-48 overflow-y-auto whitespace-pre-wrap">
              {agentPrompt}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Agent stats</div>
            {[
              ['Total trades',   '847'],
              ['Winning trades', '601'],
              ['Losing trades',  '246'],
              ['Copies of you',  '12'],
              ['Total earned',   '11,300 $AGENT'],
              ['Member since',   'Apr 2025'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-500">{l}</span>
                <span className="text-xs font-semibold text-gray-900">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}