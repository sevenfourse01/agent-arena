'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COIN_COLORS = {
  BTC:   'bg-amber-100 text-amber-700',
  ETH:   'bg-blue-100 text-blue-700',
  SOL:   'bg-purple-100 text-purple-700',
  BNB:   'bg-yellow-100 text-yellow-700',
  AVAX:  'bg-red-100 text-red-700',
  MATIC: 'bg-violet-100 text-violet-700',
  DOGE:  'bg-amber-100 text-amber-800',
  SHIB:  'bg-red-100 text-red-800',
  PEPE:  'bg-green-100 text-green-800',
  WIF:   'bg-purple-100 text-purple-800',
  BONK:  'bg-orange-100 text-orange-800',
  FLOKI: 'bg-yellow-100 text-yellow-800',
  AGENT: 'bg-emerald-100 text-emerald-700',
  MEME:  'bg-green-100 text-green-700',
}

function AgentCard({ agent, onClick }) {
  const ret         = parseFloat(agent.total_return || 0)
  const isPos       = ret >= 0
  const coins       = Array.isArray(agent.coins) ? agent.coins : []
  const cash        = parseFloat(agent.cash_balance ?? agent.portfolio_value ?? 10000)
  const invested    = parseFloat(agent.invested_value ?? 0)
  const total       = cash + invested
  const cashPct     = total > 0 ? Math.round((cash / total) * 100) : 100
  const investedPct = 100 - cashPct

  return (
    <div onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
            {agent.name?.slice(0,2)?.toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{agent.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {agent.is_copy ? '📋 Copied agent' : '🤖 Your agent'}
            </div>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agent.status==='active'?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
          {agent.status==='active'?'● Active':'○ Paused'}
        </span>
      </div>

      {/* Return + Win rate */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400 mb-0.5">Total return</div>
          <div className={`text-sm font-bold ${isPos?'text-emerald-600':'text-red-500'}`}>
            {isPos?'+':''}{ret.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400 mb-0.5">Win rate</div>
          <div className="text-sm font-bold text-gray-900">{agent.win_rate || 0}%</div>
        </div>
      </div>

      {/* Portfolio split */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Cash <span className="font-semibold text-gray-700">${cash.toLocaleString('en-US', {maximumFractionDigits:0})}</span></span>
          <span>Invested <span className="font-semibold text-emerald-600">${invested.toLocaleString('en-US', {maximumFractionDigits:0})}</span></span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div style={{ width:`${cashPct}%` }} className="bg-gray-300 transition-all"/>
            <div style={{ width:`${investedPct}%` }} className="bg-emerald-500 transition-all"/>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-300 mt-0.5">
          <span>Total: ${total.toLocaleString('en-US', {maximumFractionDigits:0})}</span>
        </div>
      </div>

      {/* Coin bubbles */}
      <div className="flex flex-wrap gap-1">
        {coins.map(c => (
          <span key={c} className={`text-xs px-2 py-0.5 rounded-full font-medium ${COIN_COLORS[c]||'bg-gray-100 text-gray-500'}`}>
            {c}
          </span>
        ))}
        {coins.length === 0 && <span className="text-xs text-gray-300">No coins selected</span>}
      </div>
    </div>
  )
}

export default function AgentCockpit({ user, onSelectAgent, onCreateAgent }) {
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      const { data } = await supabase.from('agents').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setAgents(data || [])
      setLoading(false)
    }
    load()
  }, [user])

  const filtered  = agents.filter(a => a.name?.toLowerCase().includes(search.toLowerCase()))
  const freeSlots = Math.max(0, 3 - agents.filter(a => !a.is_copy).length)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Agents</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {agents.length} agent{agents.length!==1?'s':''} · {freeSlots} free slot{freeSlots!==1?'s':''} remaining
          </p>
        </div>
        <button onClick={onCreateAgent} disabled={freeSlots === 0}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <span className="text-lg leading-none">+</span> Launch new agent
        </button>
      </div>

      <div className="relative mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search your agents..."
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 pl-10"/>
        <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">🔍</span>
      </div>

      {freeSlots > 0 && agents.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center mb-6">
          <div className="text-3xl mb-3">🤖</div>
          <div className="text-sm font-bold text-gray-900 mb-1">No agents yet</div>
          <div className="text-xs text-gray-500 mb-4">You have {freeSlots} free agent slot{freeSlots!==1?'s':''}. Launch your first AI trading agent now.</div>
          <button onClick={onCreateAgent}
            className="bg-emerald-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-emerald-600 transition-colors">
            Launch your first agent →
          </button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-200"/>
                <div className="flex-1"><div className="h-3 bg-gray-200 rounded mb-1"/><div className="h-2 bg-gray-100 rounded w-2/3"/></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">{[1,2].map(j=><div key={j} className="h-12 bg-gray-100 rounded-lg"/>)}</div>
              <div className="h-4 bg-gray-100 rounded mb-3"/>
              <div className="flex gap-1">{[1,2].map(j=><div key={j} className="h-5 w-12 bg-gray-100 rounded-full"/>)}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(agent => (
            <AgentCard key={agent.id} agent={agent} onClick={() => onSelectAgent(agent)}/>
          ))}
          {Array.from({ length: freeSlots }).map((_, i) => (
            <button key={`slot-${i}`} onClick={onCreateAgent}
              className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center min-h-[180px] gap-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">+</div>
              <div className="text-sm font-medium text-gray-400">Empty slot</div>
              <div className="text-xs text-gray-300">Launch a new agent</div>
            </button>
          ))}
        </div>
      )}

      {!loading && agents.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">No agents matching "{search}"</div>
      )}

      {freeSlots === 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-sm font-semibold text-amber-800 mb-1">All 3 free slots used</div>
          <div className="text-xs text-amber-600">Unlock more agents with $AGENT tokens — coming soon.</div>
        </div>
      )}
    </div>
  )
}