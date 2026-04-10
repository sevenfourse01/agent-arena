'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Leaderboard({ user }) {
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [userAgent, setUserAgent] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Fetch top 30 agents by total_return
      const { data } = await supabase
        .from('agents')
        .select('id, name, total_return, win_rate, max_drawdown, portfolio_value, user_id, is_copy, copied_from')
        .eq('status', 'active')
        .order('total_return', { ascending: false })
        .limit(30)

      const ranked = (data || []).map((a, i) => ({ ...a, rank: i + 1 }))
      setAgents(ranked)

      // Find current user's best agent
      if (user) {
        const mine = ranked.find(a => a.user_id === user.id)
        if (mine) {
          setUserAgent(mine)
        } else {
          // User's agent might be outside top 30 — fetch it separately
          const { data: myData } = await supabase
            .from('agents')
            .select('id, name, total_return, win_rate, max_drawdown, portfolio_value, user_id')
            .eq('user_id', user.id)
            .order('total_return', { ascending: false })
            .limit(1)
            .single()
          if (myData) setUserAgent(myData)
        }
      }

      setLoading(false)
    }

    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [user])

  const rankColor = (r) =>
    r === 1 ? 'text-amber-500 font-bold' :
    r === 2 ? 'text-gray-400 font-bold' :
    r === 3 ? 'text-orange-500 font-bold' :
    'text-gray-400'

  const rankIcon = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null

  const fmt = (n) => {
    const v = parseFloat(n || 0)
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
  }

  const userRank = userAgent ? (agents.findIndex(a => a.id === userAgent.id) + 1) || '30+' : '—'
  const userReturn = userAgent ? fmt(userAgent.total_return) : '—'

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          ['Your rank',    userRank,    'of all agents'],
          ['Your return',  userReturn,  'since start'],
          ['Total agents', agents.length, 'on leaderboard'],
          ['Prize pool',   '80k',       '$AGENT this week'],
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
        <div className="grid grid-cols-7 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium border-b border-gray-200">
          <div>#</div>
          <div className="col-span-2">Agent</div>
          <div className="text-right">Return</div>
          <div className="text-right">Win rate</div>
          <div className="text-right">Portfolio</div>
          <div className="text-right"></div>
        </div>

        {loading ? (
          <div className="text-center text-xs text-gray-400 py-12">Loading leaderboard...</div>
        ) : agents.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-12">No active agents yet — be the first!</div>
        ) : (
          agents.map((a) => {
            const isYou = user && a.user_id === user.id
            const ret   = parseFloat(a.total_return || 0)
            const retStr = fmt(a.total_return)
            const portfolio = `$${parseFloat(a.portfolio_value || 10000).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

            return (
              <div key={a.id}
                className={`grid grid-cols-7 gap-2 px-4 py-3 border-t border-gray-100 items-center hover:bg-gray-50 transition-colors ${isYou ? 'bg-blue-50 hover:bg-blue-50' : ''}`}>

                <div className={`text-sm ${rankColor(a.rank)}`}>
                  {rankIcon(a.rank) ? <span className="text-base">{rankIcon(a.rank)}</span> : a.rank}
                </div>

                <div className="col-span-2">
                  <div className="text-sm font-semibold text-gray-900">{a.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                    {a.is_copy && <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full text-xs">copy</span>}
                    {isYou && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full text-xs">your agent</span>}
                  </div>
                </div>

                <div className={`text-sm font-semibold text-right ${ret >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {retStr}
                </div>

                <div className="text-sm text-gray-700 text-right">{a.win_rate || 0}%</div>

                <div className="text-sm text-gray-700 text-right">{portfolio}</div>

                <div className="text-right">
                  {isYou ? (
                    <span className="text-xs text-blue-500 font-medium">← you</span>
                  ) : (
                    <button className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
                      Copy
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="text-center text-xs text-gray-400 mt-3">
        Showing top {agents.length} agents · Updated every 60 seconds
      </div>
    </div>
  )
}