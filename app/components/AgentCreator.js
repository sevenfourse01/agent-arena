'use client'
import { useState } from 'react'
import { Keypair } from '@solana/web3.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TOTAL_STEPS = 5

const COIN_CATALOGUE = {
  'Major Crypto': [
    { id: 'BTC',   label: 'Bitcoin',   symbol: 'BTC',   icon: '₿',  color: '#f59e0b' },
    { id: 'ETH',   label: 'Ethereum',  symbol: 'ETH',   icon: 'Ξ',  color: '#6366f1' },
    { id: 'SOL',   label: 'Solana',    symbol: 'SOL',   icon: '◎',  color: '#a855f7' },
    { id: 'BNB',   label: 'BNB',       symbol: 'BNB',   icon: '⬡',  color: '#eab308' },
    { id: 'AVAX',  label: 'Avalanche', symbol: 'AVAX',  icon: '▲',  color: '#ef4444' },
    { id: 'MATIC', label: 'Polygon',   symbol: 'MATIC', icon: '⬟',  color: '#8b5cf6' },
  ],
  'Meme Coins': [
    { id: 'DOGE',  label: 'Dogecoin',  symbol: 'DOGE',  icon: '🐕', color: '#ca8a04' },
    { id: 'SHIB',  label: 'Shiba Inu', symbol: 'SHIB',  icon: '🐕‍🦺', color: '#dc2626' },
    { id: 'PEPE',  label: 'Pepe',      symbol: 'PEPE',  icon: '🐸', color: '#16a34a' },
    { id: 'WIF',   label: 'dogwifhat', symbol: 'WIF',   icon: '🎩', color: '#7c3aed' },
    { id: 'BONK',  label: 'Bonk',      symbol: 'BONK',  icon: '🔨', color: '#ea580c' },
    { id: 'FLOKI', label: 'Floki',     symbol: 'FLOKI', icon: '⚡', color: '#d97706' },
  ],
}

const ARENA_ALPHA_PROMPT = `You are Arena Alpha, an elite AI trading agent built on proven quantitative strategies. You operate with institutional-grade discipline and never deviate from your core rules.

CORE STRATEGY — MOMENTUM + MEAN REVERSION HYBRID:
You combine trend-following with strategic pullback entries. You never chase pumps. You buy strength after confirmation, not speculation.

ENTRY RULES (ALL must be met):
- RSI between 45–65 (momentum zone, not overbought/oversold)
- MACD histogram positive and increasing
- Price above 6-candle moving average
- Volume above 24h average
- 24h price change between -3% and +8%
- Maximum 2 open positions at any time

EXIT RULES:
- Take-profit: hit the configured take-profit ratio
- Stop-loss: hit the configured max risk per trade
- RSI exceeds 75 (overbought — exit immediately)
- MACD histogram turns negative while in profit

DISCIPLINE:
- Never enter a trade just because conditions are close
- Always explain your reasoning in plain English
- Cut losses fast, let winners run
- Ignore noise — only trade high-conviction setups`

const DEFAULT_PROMPT = ARENA_ALPHA_PROMPT

export default function AgentCreator({ user, onComplete, onCancel, agentCount }) {
  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({
    name:               '',
    coins:              [],
    maxRiskPerTrade:    2,
    maxDrawdown:        10,
    maxExposure:        70,
    maxSingleAsset:     30,
    takeProfitRatio:    3,
    tradingHours:       'always',
    aggressiveness:     'balanced',
    learnFromLosses:    true,
    autoReduceDrawdown: true,
    pauseOnDailyLoss:   true,
    useRedditSentiment: false,
    useNewsSentiment:   false,
    useFearGreed:       true,
    prompt:             DEFAULT_PROMPT,
  })

  const isFreeSlotAvailable = agentCount < 3

  function update(key, val) { setForm(f => ({ ...f, [key]: val })) }
  function toggleCoin(id) {
    setForm(f => ({ ...f, coins: f.coins.includes(id) ? f.coins.filter(c => c !== id) : [...f.coins, id] }))
  }

  async function handleCreate() {
    setSaving(true)
    const wallet = Keypair.generate()
    const { error } = await supabase.from('agents').insert({
      user_id:    user.id,
      name:       form.name || `Agent ${agentCount + 1}`,
      prompt:     form.prompt,
      coins:      form.coins,
      risk_settings: {
        maxRiskPerTrade:    form.maxRiskPerTrade,
        maxDrawdown:        form.maxDrawdown,
        maxExposure:        form.maxExposure,
        maxSingleAsset:     form.maxSingleAsset,
        takeProfitRatio:    form.takeProfitRatio,
        tradingHours:       form.tradingHours,
      },
      behavior_settings: {
        aggressiveness:     form.aggressiveness,
        learnFromLosses:    form.learnFromLosses,
        autoReduceDrawdown: form.autoReduceDrawdown,
        pauseOnDailyLoss:   form.pauseOnDailyLoss,
        useRedditSentiment: form.useRedditSentiment,
        useNewsSentiment:   form.useNewsSentiment,
        useFearGreed:       form.useFearGreed,
      },
      wallet_public_key:  wallet.publicKey.toString(),
      wallet_private_key: Buffer.from(wallet.secretKey).toString('base64'),
      portfolio_value:    10000,
      cash_balance:       10000,
      invested_value:     0,
      total_return:       0,
      win_rate:           0,
      max_drawdown:       0,
      status:             'active',
    })
    setSaving(false)
    if (!error) onComplete()
  }

  const progress = (step / TOTAL_STEPS) * 100

  return (
    <div style={{ position:'fixed', inset:0, background:'#0a0a0a', zIndex:1000, display:'flex', flexDirection:'column', fontFamily:'sans-serif', color:'white', overflow:'hidden' }}>
      {/* Top bar */}
      <div style={{ padding:'20px 40px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #1a1a1a' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'#10b981' }}/>
          <span style={{ fontWeight:'600', fontSize:'15px' }}>Agent Arena</span>
        </div>
        <div style={{ flex:1, maxWidth:'300px', margin:'0 40px' }}>
          <div style={{ height:'3px', background:'#1a1a1a', borderRadius:'99px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'#10b981', borderRadius:'99px', transition:'width 0.4s ease' }}/>
          </div>
          <div style={{ textAlign:'center', fontSize:'11px', color:'#555', marginTop:'6px' }}>Step {step} of {TOTAL_STEPS}</div>
        </div>
        <button onClick={onCancel} style={{ background:'transparent', border:'1px solid #333', color:'#888', padding:'6px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
          Cancel
        </button>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}>
        <div style={{ maxWidth:'680px', width:'100%' }}>

          {/* STEP 1 — Name */}
          {step === 1 && (
            <div>
              <div style={{ fontSize:'12px', color:'#10b981', fontWeight:'700', letterSpacing:'0.1em', marginBottom:'12px' }}>STEP 1 OF 5</div>
              <h1 style={{ fontSize:'42px', fontWeight:'700', lineHeight:'1.2', marginBottom:'12px' }}>Name your agent.</h1>
              <p style={{ color:'#555', fontSize:'16px', marginBottom:'40px' }}>Give your AI trading agent a name. Choose something that reflects its personality.</p>
              <input
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="e.g. AlphaScalper, MoonBot, SolanaKing..."
                onKeyDown={e => e.key === 'Enter' && form.name.trim() && setStep(2)}
                style={{ width:'100%', background:'#111', border:'2px solid #222', borderRadius:'12px', padding:'18px 20px', color:'white', fontSize:'20px', outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#10b981'}
                onBlur={e => e.target.style.borderColor='#222'}
                autoFocus
              />
              {!isFreeSlotAvailable && (
                <div style={{ marginTop:'16px', background:'#2d1a0a', border:'1px solid #5c3a1a', borderRadius:'10px', padding:'12px 16px', fontSize:'13px', color:'#f59e0b' }}>
                  You have used all 3 free agent slots. Upgrading with $AGENT tokens will be available soon.
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Coin Catalogue */}
          {step === 2 && (
            <div>
              <div style={{ fontSize:'12px', color:'#10b981', fontWeight:'700', letterSpacing:'0.1em', marginBottom:'12px' }}>STEP 2 OF 5</div>
              <h1 style={{ fontSize:'42px', fontWeight:'700', lineHeight:'1.2', marginBottom:'12px' }}>What should it trade?</h1>
              <p style={{ color:'#555', fontSize:'16px', marginBottom:'32px' }}>Choose from major crypto or meme coins. You can pick multiple across categories.</p>

              {Object.entries(COIN_CATALOGUE).map(([category, coins]) => (
                <div key={category} style={{ marginBottom:'28px' }}>
                  <div style={{ fontSize:'11px', color:'#555', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'12px', paddingBottom:'8px', borderBottom:'1px solid #1a1a1a' }}>
                    {category}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                    {coins.map(coin => {
                      const sel = form.coins.includes(coin.id)
                      return (
                        <button key={coin.id} onClick={() => toggleCoin(coin.id)}
                          style={{ background: sel ? '#0f2d1f' : '#111', border: `2px solid ${sel ? '#10b981' : '#222'}`, borderRadius:'12px', padding:'16px', cursor:'pointer', textAlign:'left', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'12px' }}>
                          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                            {coin.icon}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ color:'white', fontWeight:'700', fontSize:'13px' }}>{coin.label}</div>
                            <div style={{ color:'#555', fontSize:'11px', marginTop:'1px' }}>{coin.symbol}</div>
                          </div>
                          {sel && <div style={{ color:'#10b981', fontSize:'14px', flexShrink:0 }}>✓</div>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {form.coins.length > 0 && (
                <div style={{ background:'#0f2d1f', border:'1px solid #1a5c3a', borderRadius:'10px', padding:'10px 14px', fontSize:'12px', color:'#10b981' }}>
                  Selected: {form.coins.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Risk */}
          {step === 3 && (
            <div>
              <div style={{ fontSize:'12px', color:'#10b981', fontWeight:'700', letterSpacing:'0.1em', marginBottom:'12px' }}>STEP 3 OF 5</div>
              <h1 style={{ fontSize:'42px', fontWeight:'700', lineHeight:'1.2', marginBottom:'12px' }}>Set the boundaries.</h1>
              <p style={{ color:'#555', fontSize:'16px', marginBottom:'40px' }}>Define how much risk your agent is allowed to take. These are hard limits it cannot exceed.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'28px' }}>
                {[
                  { key:'maxRiskPerTrade',  label:'Max risk per trade',     min:1,  max:10,  step:1,   unit:'%', desc:'Maximum % of portfolio risked on a single trade' },
                  { key:'maxDrawdown',      label:'Max total drawdown',     min:5,  max:50,  step:5,   unit:'%', desc:'Agent pauses if portfolio drops by this amount' },
                  { key:'maxExposure',      label:'Max portfolio exposure', min:20, max:100, step:5,   unit:'%', desc:'Maximum % of portfolio deployed at any time' },
                  { key:'maxSingleAsset',   label:'Max single asset',       min:10, max:100, step:5,   unit:'%', desc:'Maximum allocation to any single coin' },
                  { key:'takeProfitRatio',  label:'Take-profit ratio',      min:1,  max:10,  step:0.5, unit:'x', desc:'Risk/reward e.g. 3x = target 3x the amount risked' },
                ].map(({ key, label, min, max, step: s, unit, desc }) => (
                  <div key={key}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'8px' }}>
                      <div>
                        <span style={{ fontSize:'14px', fontWeight:'600', color:'white' }}>{label}</span>
                        <span style={{ fontSize:'12px', color:'#555', marginLeft:'8px' }}>{desc}</span>
                      </div>
                      <span style={{ fontSize:'20px', fontWeight:'700', color:'#10b981', minWidth:'60px', textAlign:'right' }}>
                        {form[key]}{unit}
                      </span>
                    </div>
                    <input type="range" min={min} max={max} step={s} value={form[key]}
                      onChange={e => update(key, parseFloat(e.target.value))}
                      style={{ width:'100%', accentColor:'#10b981', cursor:'pointer' }}/>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#333', marginTop:'2px' }}>
                      <span>{min}{unit}</span><span>{max}{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4 — Behaviour + Sentiment */}
          {step === 4 && (
            <div>
              <div style={{ fontSize:'12px', color:'#10b981', fontWeight:'700', letterSpacing:'0.1em', marginBottom:'12px' }}>STEP 4 OF 5</div>
              <h1 style={{ fontSize:'42px', fontWeight:'700', lineHeight:'1.2', marginBottom:'12px' }}>How should it behave?</h1>
              <p style={{ color:'#555', fontSize:'16px', marginBottom:'32px' }}>Set your agent's personality and choose what information it uses to make decisions.</p>

              {/* Aggressiveness */}
              <div style={{ marginBottom:'28px' }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#888', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Aggressiveness</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                  {[['conservative','🐢','Conservative','Fewer trades, higher confidence'],
                    ['balanced','⚖️','Balanced','Mix of safety and opportunity'],
                    ['aggressive','🦅','Aggressive','More trades, higher risk tolerance'],
                  ].map(([val,icon,label,desc])=>(
                    <button key={val} onClick={()=>update('aggressiveness',val)}
                      style={{ background:form.aggressiveness===val?'#0f2d1f':'#111', border:`2px solid ${form.aggressiveness===val?'#10b981':'#222'}`, borderRadius:'12px', padding:'14px', cursor:'pointer', textAlign:'left', transition:'all 0.2s' }}>
                      <div style={{ fontSize:'20px', marginBottom:'6px' }}>{icon}</div>
                      <div style={{ color:'white', fontWeight:'600', fontSize:'13px' }}>{label}</div>
                      <div style={{ color:'#555', fontSize:'11px', marginTop:'3px' }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trading hours */}
              <div style={{ marginBottom:'28px' }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#888', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Trading hours</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                  {[['always','🌍','24/7','Any time, any session'],
                    ['us','🇺🇸','US hours','9:30am–4pm EST weekdays'],
                    ['eu','🇪🇺','EU hours','8am–5pm CET weekdays'],
                  ].map(([val,icon,label,desc])=>(
                    <button key={val} onClick={()=>update('tradingHours',val)}
                      style={{ background:form.tradingHours===val?'#0f2d1f':'#111', border:`2px solid ${form.tradingHours===val?'#10b981':'#222'}`, borderRadius:'12px', padding:'14px', cursor:'pointer', textAlign:'left', transition:'all 0.2s' }}>
                      <div style={{ fontSize:'20px', marginBottom:'6px' }}>{icon}</div>
                      <div style={{ color:'white', fontWeight:'600', fontSize:'13px' }}>{label}</div>
                      <div style={{ color:'#555', fontSize:'11px', marginTop:'3px' }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sentiment inputs */}
              <div style={{ marginBottom:'28px' }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#888', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Sentiment inputs</div>
                <div style={{ fontSize:'12px', color:'#444', marginBottom:'12px' }}>Choose what real-world signals your agent reads before making decisions.</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {[
                    ['useFearGreed',       '😨', 'Fear & Greed Index',    'Crypto market fear/greed score — always recommended'],
                    ['useNewsSentiment',   '📰', 'Crypto news headlines', 'Latest crypto news from CryptoPanic — agent reads and weighs sentiment'],
                    ['useRedditSentiment', '🔴', 'Reddit sentiment',      'Trending topics from r/CryptoCurrency and r/Bitcoin'],
                  ].map(([key,icon,label,desc])=>(
                    <div key={key} onClick={()=>update(key,!form[key])}
                      style={{ background:'#111', border:`2px solid ${form[key]?'#10b981':'#222'}`, borderRadius:'12px', padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:'14px', transition:'all 0.2s' }}>
                      <span style={{ fontSize:'20px', flexShrink:0 }}>{icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'white', fontWeight:'600', fontSize:'13px' }}>{label}</div>
                        <div style={{ color:'#555', fontSize:'11px', marginTop:'2px' }}>{desc}</div>
                      </div>
                      <div style={{ width:'40px', height:'22px', borderRadius:'99px', background:form[key]?'#10b981':'#333', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                        <div style={{ width:'16px', height:'16px', borderRadius:'50%', background:'white', position:'absolute', top:'3px', left:form[key]?'21px':'3px', transition:'left 0.2s' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Behaviour toggles */}
              <div>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#888', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Risk behaviour</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {[
                    ['learnFromLosses','🧠','Learn from losses','Agent analyses losing trades and adjusts strategy'],
                    ['autoReduceDrawdown','📉','Auto-reduce on drawdown','Reduces position sizes when drawdown increases'],
                    ['pauseOnDailyLoss','⏸️','Pause if -5% in one day','Stops trading for 24h if daily loss hits 5%'],
                  ].map(([key,icon,label,desc])=>(
                    <div key={key} onClick={()=>update(key,!form[key])}
                      style={{ background:'#111', border:`2px solid ${form[key]?'#10b981':'#222'}`, borderRadius:'12px', padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:'14px', transition:'all 0.2s' }}>
                      <span style={{ fontSize:'18px', flexShrink:0 }}>{icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ color:'white', fontWeight:'600', fontSize:'13px' }}>{label}</div>
                        <div style={{ color:'#555', fontSize:'11px', marginTop:'2px' }}>{desc}</div>
                      </div>
                      <div style={{ width:'40px', height:'22px', borderRadius:'99px', background:form[key]?'#10b981':'#333', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                        <div style={{ width:'16px', height:'16px', borderRadius:'50%', background:'white', position:'absolute', top:'3px', left:form[key]?'21px':'3px', transition:'left 0.2s' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 — Prompt */}
          {step === 5 && (
            <div>
              <div style={{ fontSize:'12px', color:'#10b981', fontWeight:'700', letterSpacing:'0.1em', marginBottom:'12px' }}>STEP 5 OF 5</div>
              <h1 style={{ fontSize:'42px', fontWeight:'700', lineHeight:'1.2', marginBottom:'12px' }}>Write its brain.</h1>
              <p style={{ color:'#555', fontSize:'16px', marginBottom:'16px' }}>Describe your trading strategy. The Arena Alpha strategy is pre-loaded — edit or replace it.</p>
              <textarea
                value={form.prompt}
                onChange={e => update('prompt', e.target.value)}
                style={{ width:'100%', background:'#111', border:'2px solid #222', borderRadius:'12px', padding:'18px 20px', color:'white', fontSize:'12px', outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:'220px', fontFamily:'monospace', lineHeight:'1.7', transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#10b981'}
                onBlur={e => e.target.style.borderColor='#222'}
              />
              <div style={{ marginTop:'20px', background:'#0f2d1f', border:'1px solid #1a5c3a', borderRadius:'12px', padding:'16px 20px' }}>
                <div style={{ fontSize:'12px', color:'#10b981', fontWeight:'700', marginBottom:'8px' }}>Agent summary</div>
                <div style={{ fontSize:'13px', color:'#888', lineHeight:'1.8' }}>
                  <b style={{ color:'white' }}>{form.name || 'Your agent'}</b> will trade{' '}
                  <b style={{ color:'white' }}>{form.coins.length > 0 ? form.coins.join(', ') : 'no coins selected'}</b> with max{' '}
                  <b style={{ color:'white' }}>{form.maxRiskPerTrade}%</b> risk per trade and a{' '}
                  <b style={{ color:'white' }}>{form.takeProfitRatio}x</b> take-profit ratio. Sentiment signals:{' '}
                  <b style={{ color:'white' }}>
                    {[form.useFearGreed && 'Fear & Greed', form.useNewsSentiment && 'News', form.useRedditSentiment && 'Reddit'].filter(Boolean).join(', ') || 'none'}
                  </b>.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ padding:'20px 40px', borderTop:'1px solid #1a1a1a', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={() => step > 1 && setStep(s => s - 1)}
          style={{ background:'transparent', border:'1px solid #333', color: step === 1 ? '#333' : '#888', padding:'10px 28px', borderRadius:'8px', cursor: step === 1 ? 'default' : 'pointer', fontSize:'14px' }}>
          Back
        </button>
        <div style={{ display:'flex', gap:'6px' }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{ width: i + 1 === step ? '24px' : '8px', height:'8px', borderRadius:'99px', background: i + 1 <= step ? '#10b981' : '#333', transition:'all 0.3s' }}/>
          ))}
        </div>
        {step < TOTAL_STEPS ? (
          <button
            onClick={() => {
              if (step === 1 && !form.name.trim()) return
              if (step === 2 && form.coins.length === 0) return
              setStep(s => s + 1)
            }}
            disabled={(step === 1 && !form.name.trim()) || (step === 2 && form.coins.length === 0) || !isFreeSlotAvailable}
            style={{ background:'#10b981', color:'white', border:'none', padding:'10px 28px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600', opacity: ((step===1&&!form.name.trim())||(step===2&&form.coins.length===0)||!isFreeSlotAvailable)?0.4:1 }}>
            Continue
          </button>
        ) : (
          <button onClick={handleCreate} disabled={saving}
            style={{ background:'#10b981', color:'white', border:'none', padding:'10px 28px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600', opacity:saving?0.6:1 }}>
            {saving ? 'Launching...' : '🚀 Launch agent'}
          </button>
        )}
      </div>
    </div>
  )
}