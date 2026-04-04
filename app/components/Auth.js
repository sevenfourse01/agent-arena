'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Keypair } from '@solana/web3.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export { supabase }

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showVerifyPopup, setShowVerifyPopup] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    onLogin(data.user, profile)
    setLoading(false)
  }

  async function handleSignup() {
    setLoading(true)
    setError('')
    if (!username.trim()) { setError('Username is required'); setLoading(false); return }

    // Generate a new Solana wallet for this user's agent
    const wallet = Keypair.generate()
    const walletPublicKey  = wallet.publicKey.toString()
    const walletPrivateKey = Buffer.from(wallet.secretKey).toString('base64')

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    if (data.user) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: username.trim(),
        wallet_public_key:  walletPublicKey,
        wallet_private_key: walletPrivateKey,
        agent_prompt: `You are an autonomous trading agent on Agent Arena.
Monitor: BTC, ETH, SOL, $AGENT
Strategy: momentum + sentiment hybrid
Risk per trade: max 2% of portfolio
Max drawdown: -10% total
Max exposure: 70% at any time
Stop-loss: trailing 2%
Take-profit: 1:3 risk/reward
Use RSI, MACD, MA crossovers.
Explain every decision in plain English.`,
      })if (insertError) console.log('INSERT ERROR:', insertError.message)
      setShowVerifyPopup(true)
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>

      {/* EMAIL VERIFICATION POPUP */}
      {showVerifyPopup && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#111',border:'1px solid #10b981',borderRadius:'20px',padding:'40px',maxWidth:'380px',width:'100%',textAlign:'center'}}>
            <div style={{fontSize:'48px',marginBottom:'16px'}}>📧</div>
            <h2 style={{color:'white',fontSize:'20px',fontWeight:'700',marginBottom:'10px'}}>Check your email</h2>
            <p style={{color:'#888',fontSize:'14px',lineHeight:'1.6',marginBottom:'8px'}}>
              We've sent a verification link to<br/>
              <span style={{color:'#10b981',fontWeight:'600'}}>{email}</span>
            </p>
            <p style={{color:'#888',fontSize:'14px',lineHeight:'1.6'}}>
              Click the link in the email and you'll be taken straight into Agent Arena.
            </p>
            <p style={{color:'#444',fontSize:'11px',marginTop:'16px'}}>Didn't get it? Check your spam folder.</p>
          </div>
        </div>
      )}

      <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:'16px',padding:'40px',width:'100%',maxWidth:'400px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'32px',justifyContent:'center'}}>
          <div style={{width:'24px',height:'24px',borderRadius:'50%',background:'#10b981'}}/>
          <span style={{color:'white',fontWeight:'700',fontSize:'18px'}}>Agent Arena</span>
        </div>

        <div style={{display:'flex',gap:'0',marginBottom:'24px',background:'#0a0a0a',borderRadius:'8px',padding:'4px'}}>
          <button onClick={() => setMode('login')}
            style={{flex:1,padding:'8px',borderRadius:'6px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:'500',background:mode==='login'?'#10b981':'transparent',color:mode==='login'?'white':'#666'}}>
            Log in
          </button>
          <button onClick={() => setMode('signup')}
            style={{flex:1,padding:'8px',borderRadius:'6px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:'500',background:mode==='signup'?'#10b981':'transparent',color:mode==='signup'?'white':'#666'}}>
            Sign up
          </button>
        </div>

        {message && <div style={{background:'#0f2d1f',color:'#10b981',padding:'10px 14px',borderRadius:'8px',fontSize:'13px',marginBottom:'16px'}}>{message}</div>}
        {error && <div style={{background:'#2d0f0f',color:'#ef4444',padding:'10px 14px',borderRadius:'8px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}

        {mode === 'signup' && (
          <div style={{marginBottom:'14px'}}>
            <div style={{color:'#888',fontSize:'12px',marginBottom:'6px'}}>Username</div>
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="e.g. cryptowolf"
              style={{width:'100%',background:'#0a0a0a',border:'1px solid #222',borderRadius:'8px',padding:'10px 12px',color:'white',fontSize:'13px',outline:'none'}}/>
          </div>
        )}

        <div style={{marginBottom:'14px'}}>
          <div style={{color:'#888',fontSize:'12px',marginBottom:'6px'}}>Email</div>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" type="email"
            style={{width:'100%',background:'#0a0a0a',border:'1px solid #222',borderRadius:'8px',padding:'10px 12px',color:'white',fontSize:'13px',outline:'none'}}/>
        </div>

        <div style={{marginBottom:'24px'}}>
          <div style={{color:'#888',fontSize:'12px',marginBottom:'6px'}}>Password</div>
          <input value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" type="password"
            onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}
            style={{width:'100%',background:'#0a0a0a',border:'1px solid #222',borderRadius:'8px',padding:'10px 12px',color:'white',fontSize:'13px',outline:'none'}}/>
        </div>

        <button onClick={mode === 'login' ? handleLogin : handleSignup} disabled={loading}
          style={{width:'100%',background:'#10b981',color:'white',border:'none',padding:'12px',borderRadius:'8px',fontSize:'14px',fontWeight:'600',cursor:'pointer',opacity:loading?0.7:1}}>
          {loading ? '...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>

        <div style={{textAlign:'center',marginTop:'20px',fontSize:'12px',color:'#555'}}>
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{color:'#10b981',cursor:'pointer'}}>
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </span>
        </div>
      </div>
    </div>
  )
}