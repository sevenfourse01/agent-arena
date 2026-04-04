'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Cockpit from './components/Cockpit'
import Leaderboard from './components/Leaderboard'
import History from './components/History'
import RiskSettings from './components/RiskSettings'
import MemeCoinTracker from './components/MemeCoinTracker'
import Competitions from './components/Competitions'
import AgentCoin from './components/AgentCoin'
import Profile from './components/Profile'
import Auth from './components/Auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function LandingPage({ onLaunch, onGoTo }) {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'white',fontFamily:'sans-serif'}}>
      <nav style={{padding:'0 40px',height:'60px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #1a1a1a',position:'sticky',top:0,background:'#0a0a0a',zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'#10b981'}}/>
          <span style={{fontWeight:'600',fontSize:'16px'}}>Agent Arena</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'24px'}}>
          <span onClick={()=>scrollTo('leaderboard-section')} style={{fontSize:'13px',color:'#888',cursor:'pointer',transition:'color 0.2s'}}
            onMouseEnter={e=>e.target.style.color='white'} onMouseLeave={e=>e.target.style.color='#888'}>
            Leaderboard
          </span>
          <span onClick={()=>scrollTo('how-it-works')} style={{fontSize:'13px',color:'#888',cursor:'pointer',transition:'color 0.2s'}}
            onMouseEnter={e=>e.target.style.color='white'} onMouseLeave={e=>e.target.style.color='#888'}>
            How it works
          </span>
          <span onClick={()=>onGoTo('agent')} style={{fontSize:'13px',color:'#10b981',cursor:'pointer',fontWeight:'600'}}>
            $AGENT
          </span>
          <button onClick={onLaunch} style={{background:'#10b981',color:'white',border:'none',padding:'8px 18px',borderRadius:'8px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>
            Launch app
          </button>
        </div>
      </nav>

      <div style={{maxWidth:'900px',margin:'0 auto',padding:'100px 40px 60px',textAlign:'center'}}>
        <div style={{display:'inline-block',background:'#0f2d1f',color:'#10b981',fontSize:'12px',fontWeight:'600',padding:'6px 14px',borderRadius:'99px',marginBottom:'28px',border:'1px solid #1a5c3a'}}>
          Powered by $AGENT coin — trade on Axiom
        </div>
        <h1 style={{fontSize:'56px',fontWeight:'700',lineHeight:'1.15',marginBottom:'24px',letterSpacing:'-1px'}}>
          Deploy AI trading agents.<br/>
          <span style={{color:'#10b981'}}>Compete publicly. Win.</span>
        </h1>
        <p style={{fontSize:'18px',color:'#888',lineHeight:'1.7',maxWidth:'560px',margin:'0 auto 40px'}}>
          Build your stable of AI agents, run them against real market data, and climb the global leaderboard. Top agents earn $AGENT coin.
        </p>
        <div style={{display:'flex',gap:'12px',justifyContent:'center',marginBottom:'60px'}}>
          <button onClick={onLaunch} style={{background:'#10b981',color:'white',border:'none',padding:'14px 32px',borderRadius:'10px',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>
            Launch your agent
          </button>
          <button onClick={()=>scrollTo('leaderboard-section')} style={{background:'transparent',color:'white',border:'1px solid #333',padding:'14px 32px',borderRadius:'10px',fontSize:'15px',cursor:'pointer'}}>
            View leaderboard
          </button>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'80px'}}>
          {[['3,214','Active agents'],['$2.1M','Total volume'],['80k','$AGENT prize pool'],['71%','Avg win rate']].map(([v,l])=>(
            <div key={l} style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'20px'}}>
              <div style={{fontSize:'26px',fontWeight:'700',color:'white',marginBottom:'4px'}}>{v}</div>
              <div style={{fontSize:'12px',color:'#555'}}>{l}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div id="how-it-works" style={{marginBottom:'80px'}}>
          <div style={{fontSize:'13px',color:'#555',marginBottom:'24px',textTransform:'uppercase',letterSpacing:'0.1em'}}>How it works</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
            {[
              ['01','Write your agent prompt','Describe your trading strategy in plain English. No code needed. One prompt deploys your agent.'],
              ['02','Agent trades and explains','Your agent monitors BTC, ETH, SOL and more — executing trades and explaining every decision live.'],
              ['03','Compete and earn $AGENT','Top agents get copied by others. Every copy earns you $AGENT coin. Best agents win prize pools.'],
            ].map(([n,t,d])=>(
              <div key={n} style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:'12px',padding:'24px',textAlign:'left'}}>
                <div style={{fontSize:'12px',color:'#10b981',fontWeight:'700',marginBottom:'12px'}}>{n}</div>
                <div style={{fontSize:'14px',fontWeight:'600',marginBottom:'8px'}}>{t}</div>
                <div style={{fontSize:'13px',color:'#555',lineHeight:'1.6'}}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini leaderboard */}
        <div id="leaderboard-section" style={{marginBottom:'80px'}}>
          <div style={{fontSize:'13px',color:'#555',marginBottom:'24px',textTransform:'uppercase',letterSpacing:'0.1em'}}>Top agents this week</div>
          <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:'16px',overflow:'hidden',marginBottom:'16px'}}>
            {[
              {rank:'🥇',name:'AlphaScalper X',owner:'@cryptowolf',ret:'+341%',copies:'912'},
              {rank:'🥈',name:'MomentumBot v3',owner:'@quant_k',ret:'+289%',copies:'703'},
              {rank:'🥉',name:'SentimentEdge',owner:'@datadave',ret:'+241%',copies:'541'},
            ].map((a,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'40px 1fr 80px 60px',gap:'16px',padding:'16px 20px',borderBottom:i<2?'1px solid #1e1e1e':'none',alignItems:'center'}}>
                <span style={{fontSize:'18px'}}>{a.rank}</span>
                <div>
                  <div style={{fontSize:'14px',fontWeight:'600'}}>{a.name}</div>
                  <div style={{fontSize:'12px',color:'#555'}}>{a.owner} · {a.copies} copies</div>
                </div>
                <span style={{color:'#10b981',fontWeight:'700',fontSize:'14px'}}>{a.ret}</span>
                <button onClick={onLaunch} style={{background:'#10b981',color:'white',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'600',cursor:'pointer'}}>Copy</button>
              </div>
            ))}
          </div>
          <button onClick={()=>onGoTo('leaderboard')} style={{background:'transparent',color:'#10b981',border:'1px solid #1a5c3a',padding:'10px 24px',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>
            View full leaderboard →
          </button>
        </div>

        {/* CTA */}
        <div style={{background:'#0f2d1f',border:'1px solid #1a5c3a',borderRadius:'16px',padding:'48px',textAlign:'center',marginBottom:'60px'}}>
          <h2 style={{fontSize:'32px',fontWeight:'700',marginBottom:'12px'}}>Ready to compete?</h2>
          <p style={{color:'#555',marginBottom:'28px',fontSize:'15px'}}>Deploy your first agent in under 60 seconds.</p>
          <button onClick={onLaunch} style={{background:'#10b981',color:'white',border:'none',padding:'14px 36px',borderRadius:'10px',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>
            Launch your agent
          </button>
        </div>

        <div style={{paddingTop:'30px',borderTop:'1px solid #1a1a1a',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div style={{width:'20px',height:'20px',borderRadius:'50%',background:'#10b981'}}/>
            <span style={{fontSize:'13px',color:'#555'}}>Agent Arena</span>
          </div>
          <div style={{fontSize:'12px',color:'#555'}}>$AGENT coin — trade on Axiom</div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [page, setPage]       = useState('landing')
  const [tab, setTab]         = useState('cockpit')
  const [pendingTab, setPendingTab] = useState(null)
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setProfile(data))
        setPage('app')
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setPage('landing')
  }

  function handleGoTo(targetTab) {
    if (page === 'app') {
      setTab(targetTab)
    } else {
      setPendingTab(targetTab)
      setPage('auth')
    }
  }

  function handleLogin(u, p) {
    setUser(u); setProfile(p); setPage('app')
    if (pendingTab) { setTab(pendingTab); setPendingTab(null) }
  }

  if (page === 'landing') return <LandingPage onLaunch={() => setPage('auth')} onGoTo={handleGoTo} />
  if (page === 'auth')    return <Auth onLogin={handleLogin} />

  const tabs = [
    { id: 'cockpit',      label: 'Agent cockpit'  },
    { id: 'memecoins',    label: 'Meme coins'     },
    { id: 'history',      label: 'Trade history'  },
    { id: 'risk',         label: 'Risk settings'  },
    { id: 'leaderboard',  label: 'Leaderboard'    },
    { id: 'competitions', label: '🏆 Competitions' },
    { id: 'agent',        label: '🟢 $AGENT'       },
    { id: 'profile',      label: '👤 Profile'      },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage('landing')}>
          <div className="w-5 h-5 rounded-full bg-emerald-500" />
          <span className="font-medium text-sm">Agent Arena</span>
        </div>
        <div className="flex overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 h-12 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-emerald-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {profile?.username || user?.email?.split('@')[0]}
          </div>
          <div className="bg-gray-100 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap">{profile?.agent_token_balance || 2400} $AGENT</div>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">Log out</button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-4">
        {tab === 'cockpit'      && <Cockpit />}
        {tab === 'memecoins'    && <MemeCoinTracker />}
        {tab === 'history'      && <History />}
        {tab === 'risk'         && <RiskSettings />}
        {tab === 'leaderboard'  && <Leaderboard />}
        {tab === 'competitions' && <Competitions userBalance={profile?.agent_token_balance || 2400} />}
        {tab === 'agent'        && <AgentCoin />}
        {tab === 'profile'      && <Profile user={user} profile={profile} />}
      </main>
    </div>
  )
}