'use client'
import { useState } from 'react'
import Cockpit from './components/Cockpit'
import Leaderboard from './components/Leaderboard'
import History from './components/History'
import RiskSettings from './components/RiskSettings'

export default function Home() {
  const [page, setPage] = useState('cockpit')
  const tabs = [
    { id: 'cockpit', label: 'Agent cockpit' },
    { id: 'history', label: 'Trade history' },
    { id: 'risk', label: 'Risk settings' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ]
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500" />
          <span className="font-medium text-sm">Agent Arena</span>
        </div>
        <div className="flex">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setPage(t.id)}
              className={`px-4 h-12 text-xs font-medium border-b-2 transition-colors ${page === t.id ? 'border-emerald-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Agent running
          </div>
          <div className="bg-gray-100 rounded-full px-3 py-1 text-xs font-medium">2,400 $AGENT</div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-4">
        {page === 'cockpit' && <Cockpit />}
        {page === 'history' && <History />}
        {page === 'risk' && <RiskSettings />}
        {page === 'leaderboard' && <Leaderboard />}
      </main>
    </div>
  )
}