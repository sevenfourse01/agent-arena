'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TABS = ['Watchlist', 'Trending', 'New Listings']

const CHAIN_COLORS = {
  solana:   'bg-purple-50 text-purple-700',
  ethereum: 'bg-blue-50 text-blue-700',
  bsc:      'bg-yellow-50 text-yellow-700',
  base:     'bg-blue-50 text-blue-600',
  default:  'bg-gray-100 text-gray-500',
}

function chainStyle(chain) {
  return CHAIN_COLORS[chain?.toLowerCase()] || CHAIN_COLORS.default
}

function formatNum(n) {
  if (!n) return '—'
  if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n/1e3).toFixed(1) + 'K'
  return '$' + parseFloat(n).toFixed(2)
}

function formatPrice(p) {
  if (!p) return '—'
  const n = parseFloat(p)
  if (n < 0.000001) return '$' + n.toExponential(2)
  if (n < 0.01) return '$' + n.toFixed(8)
  if (n < 1)    return '$' + n.toFixed(6)
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs/24)}d ago`
}

function CoinIcon({ imageUrl, symbol, size = 32 }) {
  const [err, setErr] = useState(false)
  if (imageUrl && !err) {
    return <img src={imageUrl} alt={symbol} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>
  }
  const colors = ['from-emerald-400 to-teal-500','from-purple-400 to-pink-500','from-amber-400 to-orange-500','from-blue-400 to-indigo-500']
  const color  = colors[(symbol?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
      className={`bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold`}
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, fontSize: size * 0.35 }}>
      {symbol?.slice(0,2)?.toUpperCase()}
    </div>
  )
}

function Sparkline({ points, positive }) {
  if (!points || points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const W = 64, H = 28
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - ((p - min) / range) * (H - 4) - 2
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const color = positive ? '#10b981' : '#ef4444'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 64, height: 28 }} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

function WatchCard({ coin, onRemove, onBuy, onNoteChange, onSetAlert }) {
  const [showNote, setShowNote] = useState(false)
  const isPos = parseFloat(coin.change24h || 0) >= 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-all flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CoinIcon imageUrl={coin.imageUrl} symbol={coin.symbol} size={32}/>
          <div>
            <div className="text-sm font-bold text-gray-900">{coin.symbol}</div>
            <div className="text-xs text-gray-400 truncate max-w-[100px]">{coin.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${chainStyle(coin.chain)}`}>{coin.chain}</span>
          <button onClick={() => setShowNote(s => !s)} className="text-gray-300 hover:text-gray-500 px-1 text-sm" title="Note">📝</button>
          <button onClick={() => onRemove(coin.address)} className="text-gray-300 hover:text-red-400 px-1 text-xs font-bold" title="Remove">✕</button>
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-lg font-bold text-gray-900">{formatPrice(coin.price)}</div>
          <div className={`text-xs font-semibold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPos ? '+' : ''}{parseFloat(coin.change24h || 0).toFixed(2)}% (24h)
          </div>
        </div>
        <Sparkline points={coin.sparkline} positive={isPos}/>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-0.5">Volume 24h</div>
          <div className="text-xs font-semibold text-gray-800">{formatNum(coin.volume)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-0.5">Market cap</div>
          <div className="text-xs font-semibold text-gray-800">{formatNum(coin.mcap)}</div>
        </div>
      </div>

      {/* Note */}
      {showNote && (
        <textarea value={coin.note || ''} onChange={e => onNoteChange(coin.address, e.target.value)}
          placeholder="Why watching? e.g. volume spike, whale activity..."
          className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 resize-none h-14 focus:outline-none focus:border-emerald-400 text-gray-700"/>
      )}

      {/* Alert */}
      {coin.alert && (
        <div className="text-xs bg-amber-50 text-amber-700 rounded-lg px-2 py-1">🔔 Alert at {formatPrice(coin.alert)}</div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <button onClick={() => onSetAlert(coin)}
          className="flex-1 text-xs border border-gray-200 text-gray-600 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
          {coin.alert ? '🔔 Edit alert' : '+ Alert'}
        </button>
        <button onClick={() => onBuy(coin)}
          className="flex-1 bg-gray-900 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
          Trade →
        </button>
      </div>
    </div>
  )
}

function TrendingCard({ pair, onAdd, isNew }) {
  const isPos = parseFloat(pair.priceChange?.h24 || 0) >= 0
  const imageUrl = pair.info?.imageUrl || null
  const symbol   = pair.baseToken?.symbol || '?'
  const name     = pair.baseToken?.name || 'Unknown'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-all flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CoinIcon imageUrl={imageUrl} symbol={symbol} size={36}/>
          <div>
            <div className="text-sm font-bold text-gray-900">{symbol}</div>
            <div className="text-xs text-gray-400 truncate max-w-[100px]">{name}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${chainStyle(pair.chainId)}`}>{pair.chainId}</span>
          {isNew && pair.pairCreatedAt && (
            <span className="text-xs text-gray-400">{timeAgo(pair.pairCreatedAt)}</span>
          )}
        </div>
      </div>

      <div>
        <div className="text-base font-bold text-gray-900">{formatPrice(pair.priceUsd)}</div>
        <div className={`text-xs font-semibold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
          {isPos ? '+' : ''}{parseFloat(pair.priceChange?.h24 || 0).toFixed(2)}% (24h)
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <div className="text-xs text-gray-400">Vol: <span className="text-gray-700 font-medium">{formatNum(pair.volume?.h24)}</span></div>
        <div className="text-xs text-gray-400">MCap: <span className="text-gray-700 font-medium">{formatNum(pair.marketCap)}</span></div>
        {isNew && <div className="text-xs text-gray-400">Liq: <span className="text-gray-700 font-medium">{formatNum(pair.liquidity?.usd)}</span></div>}
      </div>

      <button onClick={() => onAdd(pair)}
        className="w-full bg-emerald-500 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-emerald-600 transition-colors">
        + Watch
      </button>
    </div>
  )
}

export default function MemeCoinTracker({ user }) {
  const [tab, setTab]               = useState('Watchlist')
  const [search, setSearch]         = useState('')
  const [searching, setSearching]   = useState(false)
  const [result, setResult]         = useState(null)
  const [searchError, setSearchError] = useState('')
  const [watchlist, setWatchlist]   = useState([])
  const [trending, setTrending]     = useState([])
  const [newListings, setNewListings] = useState([])
  const [loadingTrend, setLoadingTrend] = useState(false)
  const [loadingNew, setLoadingNew] = useState(false)
  const [sortBy, setSortBy]         = useState('added')
  const [alertModal, setAlertModal] = useState(null)
  const [alertPrice, setAlertPrice] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [newTimer, setNewTimer]     = useState(30)

  // Load watchlist from Supabase
  useEffect(() => {
    async function load() {
      if (!user) return
      const { data } = await supabase.from('profiles').select('watchlist').eq('id', user.id).single()
      if (data?.watchlist && Array.isArray(data.watchlist)) setWatchlist(data.watchlist)
    }
    load()
  }, [user])

  async function saveWatchlist(newList) {
    setWatchlist(newList)
    if (!user) return
    setSaveStatus('Saving...')
    await supabase.from('profiles').update({ watchlist: newList }).eq('id', user.id)
    setSaveStatus('✓ Saved')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  // Fetch trending — DexScreener trending endpoint for Solana
  const fetchTrending = useCallback(async () => {
    setLoadingTrend(true)
    try {
      // Use token-profiles endpoint for trending
      const res  = await fetch('https://api.dexscreener.com/token-profiles/latest/v1')
      const data = await res.json()
      // Get token addresses and fetch their pairs
      const addresses = (Array.isArray(data) ? data : [])
        .filter(t => t.chainId === 'solana')
        .slice(0, 20)
        .map(t => t.tokenAddress)
        .join(',')

      if (addresses) {
        const pairRes  = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`)
        const pairData = await pairRes.json()
        const pairs = (pairData.pairs || [])
          .filter(p => p.priceUsd && p.volume?.h24 > 500)
          .sort((a,b) => (b.volume?.h24||0) - (a.volume?.h24||0))
          .slice(0, 12)
        setTrending(pairs)
      }
    } catch(e) {
      // fallback — search for trending meme coins
      try {
        const terms = ['BONK','WIF','POPCAT','MEW','BOME','SLERF','MYRO']
        const all = []
        for (const t of terms.slice(0,4)) {
          const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${t}`)
          const d = await r.json()
          const best = (d.pairs||[]).filter(p=>p.chainId==='solana'&&p.volume?.h24>1000).sort((a,b)=>b.volume?.h24-a.volume?.h24)[0]
          if (best) all.push(best)
        }
        setTrending(all)
      } catch {}
    }
    setLoadingTrend(false)
  }, [])

  // Fetch new listings — genuinely new pairs
  const fetchNewListings = useCallback(async () => {
    setLoadingNew(true)
    setNewTimer(30)
    try {
      const res  = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana/new')
      const data = await res.json()
      const pairs = (data.pairs || [])
        .filter(p => p.priceUsd && p.pairCreatedAt && (Date.now() - p.pairCreatedAt) < 24 * 60 * 60 * 1000)
        .sort((a,b) => (b.pairCreatedAt||0) - (a.pairCreatedAt||0))
        .slice(0, 12)
      setNewListings(pairs.length > 0 ? pairs : (data.pairs||[]).sort((a,b)=>(b.pairCreatedAt||0)-(a.pairCreatedAt||0)).slice(0,12))
    } catch(e) {}
    setLoadingNew(false)
  }, [])

  useEffect(() => {
    if (tab === 'Trending') fetchTrending()
    if (tab === 'New Listings') fetchNewListings()
  }, [tab])

  // Auto-refresh new listings every 30s and countdown
  useEffect(() => {
    if (tab !== 'New Listings') return
    const countdown = setInterval(() => setNewTimer(t => Math.max(0, t - 1)), 1000)
    const refresh   = setInterval(() => fetchNewListings(), 30000)
    return () => { clearInterval(countdown); clearInterval(refresh) }
  }, [tab, fetchNewListings])

  // Live price updates for watchlist
  useEffect(() => {
    const iv = setInterval(async () => {
      if (watchlist.length === 0) return
      const updated = await Promise.all(watchlist.map(async coin => {
        try {
          const res  = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${coin.address}`)
          const data = await res.json()
          const pair = data.pairs?.[0]
          if (!pair) return coin
          const newPrice = parseFloat(pair.priceUsd)
          if (coin.alert) {
            const old = parseFloat(coin.price||0), alert = parseFloat(coin.alert)
            if ((old < alert && newPrice >= alert)||(old > alert && newPrice <= alert)) {
              alert(`🔔 ${coin.symbol} hit ${formatPrice(alert)}!`)
            }
          }
          return { ...coin, price: pair.priceUsd, change24h: pair.priceChange?.h24, volume: pair.volume?.h24, sparkline: [...(coin.sparkline||[]), newPrice].slice(-20) }
        } catch { return coin }
      }))
      setWatchlist(updated)
      if (user) await supabase.from('profiles').update({ watchlist: updated }).eq('id', user.id)
    }, 15000)
    return () => clearInterval(iv)
  }, [watchlist, user])

  async function searchCoin() {
    if (!search.trim()) return
    setSearching(true); setSearchError(''); setResult(null)
    try {
      const res  = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${search.trim()}`)
      const data = await res.json()
      if (!data.pairs?.length) { setSearchError('No coin found. Try a contract address or ticker.'); setSearching(false); return }
      setResult(data.pairs.sort((a,b)=>(b.volume?.h24||0)-(a.volume?.h24||0))[0])
    } catch { setSearchError('Failed to fetch. Try again.') }
    setSearching(false)
  }

  function pairToCoin(pair) {
    return {
      name: pair.baseToken?.name||'Unknown', symbol: pair.baseToken?.symbol||'?',
      price: pair.priceUsd, change24h: pair.priceChange?.h24, volume: pair.volume?.h24,
      mcap: pair.marketCap, chain: pair.chainId, address: pair.baseToken?.address,
      dex: pair.dexId, imageUrl: pair.info?.imageUrl||null, sparkline: [parseFloat(pair.priceUsd||0)],
      note: '', alert: null, addedAt: Date.now(),
    }
  }

  function addToWatchlist(pair) {
    const coin = pairToCoin(pair)
    const newList = watchlist.find(c => c.address === coin.address) ? watchlist : [coin, ...watchlist]
    saveWatchlist(newList)
    setResult(null); setSearch('')
  }

  function removeFromWatchlist(address) { saveWatchlist(watchlist.filter(c => c.address !== address)) }
  function updateNote(address, note)    { saveWatchlist(watchlist.map(c => c.address===address?{...c,note}:c)) }
  function setAlertForCoin(address, price) { saveWatchlist(watchlist.map(c => c.address===address?{...c,alert:price}:c)); setAlertModal(null); setAlertPrice('') }

  const sortedWatchlist = [...watchlist].sort((a,b) => {
    if (sortBy==='change') return parseFloat(b.change24h||0)-parseFloat(a.change24h||0)
    if (sortBy==='volume') return (b.volume||0)-(a.volume||0)
    if (sortBy==='mcap')   return (b.mcap||0)-(a.mcap||0)
    return (b.addedAt||0)-(a.addedAt||0)
  })

  return (
    <div>
      {/* Alert Modal */}
      {alertModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full mx-4 shadow-2xl">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Set price alert — {alertModal.symbol}</h3>
            <p className="text-xs text-gray-400 mb-3">Current price: {formatPrice(alertModal.price)}</p>
            <input value={alertPrice} onChange={e=>setAlertPrice(e.target.value)} placeholder="Target price e.g. 0.00042"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-emerald-400"/>
            <div className="flex gap-2">
              <button onClick={()=>setAlertModal(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg">Cancel</button>
              <button onClick={()=>setAlertForCoin(alertModal.address,alertPrice)} className="flex-1 bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg">Set alert</button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-gray-900">Meme Coin Tracker</div>
            <div className="text-xs text-gray-400">Search any coin — Axiom, Pump.fun, Raydium, all DEXes</div>
          </div>
          {saveStatus && <span className="text-xs text-emerald-600 font-medium">{saveStatus}</span>}
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchCoin()}
            placeholder="Contract address or ticker e.g. PEPE, BONK, WIF..."
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400 text-gray-900 placeholder-gray-400"/>
          <button onClick={searchCoin} disabled={searching}
            className="bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchError && <div className="mt-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{searchError}</div>}
        {result && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CoinIcon imageUrl={result.info?.imageUrl} symbol={result.baseToken?.symbol} size={36}/>
                <div>
                  <span className="text-sm font-bold text-gray-900">{result.baseToken?.name}</span>
                  <span className="ml-2 text-xs text-gray-500">${result.baseToken?.symbol}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${chainStyle(result.chainId)}`}>{result.chainId}</span>
                </div>
              </div>
              <button onClick={()=>addToWatchlist(result)} className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-600">+ Add to watchlist</button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[['Price',formatPrice(result.priceUsd)],
                ['24h',`${result.priceChange?.h24>=0?'+':''}${result.priceChange?.h24?.toFixed(2)}%`],
                ['Volume',formatNum(result.volume?.h24)],
                ['MCap',formatNum(result.marketCap)]
              ].map(([l,v],i)=>(
                <div key={l} className="bg-white rounded-lg p-2">
                  <div className="text-xs text-gray-400 mb-0.5">{l}</div>
                  <div className={`text-sm font-semibold ${i===1?(result.priceChange?.h24>=0?'text-emerald-600':'text-red-500'):'text-gray-900'}`}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${tab===t?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {t}{t==='Watchlist'&&watchlist.length>0?` (${watchlist.length})`:''}
          </button>
        ))}
      </div>

      {/* Watchlist */}
      {tab==='Watchlist' && (
        watchlist.length===0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-3xl mb-3">👀</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">Your watchlist is empty</div>
            <div className="text-xs text-gray-400">Search for a coin above or browse Trending to add coins</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{watchlist.length} coins · updates every 15s</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 mr-1">Sort:</span>
                {[['added','Recent'],['change','% Change'],['volume','Volume'],['mcap','MCap']].map(([val,label])=>(
                  <button key={val} onClick={()=>setSortBy(val)}
                    className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${sortBy===val?'bg-emerald-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {sortedWatchlist.map((coin,i) => (
                <WatchCard key={i} coin={coin}
                  onRemove={removeFromWatchlist}
                  onBuy={coin => window.open('https://axiom.trade','_blank')}
                  onNoteChange={updateNote}
                  onSetAlert={setAlertModal}
                />
              ))}
            </div>
          </>
        )
      )}

      {/* Trending */}
      {tab==='Trending' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">🔥 Hottest coins by volume right now</span>
            <button onClick={fetchTrending} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">↻ Refresh</button>
          </div>
          {loadingTrend ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({length:6}).map((_,i)=>(
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-3"><div className="w-9 h-9 rounded-full bg-gray-200"/><div className="flex-1"><div className="h-3 bg-gray-200 rounded mb-1"/><div className="h-2 bg-gray-100 rounded w-2/3"/></div></div>
                  <div className="h-5 bg-gray-200 rounded mb-1"/><div className="h-3 bg-gray-100 rounded w-1/2"/>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {trending.map((pair,i) => <TrendingCard key={i} pair={pair} onAdd={addToWatchlist}/>)}
            </div>
          )}
        </>
      )}

      {/* New Listings */}
      {tab==='New Listings' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">⚡ Freshly launched pairs on Solana</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Refreshes in <b className="text-gray-700">{newTimer}s</b></span>
              <button onClick={fetchNewListings} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">↻ Now</button>
            </div>
          </div>
          {loadingNew ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({length:6}).map((_,i)=>(
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-3"><div className="w-9 h-9 rounded-full bg-gray-200"/><div className="flex-1"><div className="h-3 bg-gray-200 rounded mb-1"/><div className="h-2 bg-gray-100 rounded w-2/3"/></div></div>
                  <div className="h-5 bg-gray-200 rounded mb-1"/><div className="h-3 bg-gray-100 rounded w-1/2"/>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {newListings.map((pair,i) => <TrendingCard key={i} pair={pair} onAdd={addToWatchlist} isNew={true}/>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}