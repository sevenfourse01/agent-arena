'use client'
import { useState, useEffect, useRef } from 'react'
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

function Sparkline({ points, positive }) {
  if (!points || points.length < 2) return <div className="w-16 h-8 bg-gray-100 rounded"/>
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const W = 64, H = 32
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - ((p - min) / range) * H
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const color = positive ? '#10b981' : '#ef4444'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 64, height: 32 }} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

function CoinCard({ coin, onRemove, onBuy, onNoteChange }) {
  const [showNote, setShowNote] = useState(false)
  const isPos = parseFloat(coin.change24h) >= 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {coin.imageUrl ? (
            <img src={coin.imageUrl} alt={coin.symbol} className="w-8 h-8 rounded-full" onError={e => e.target.style.display='none'}/>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {coin.symbol?.slice(0,2)}
            </div>
          )}
          <div>
            <div className="text-sm font-bold text-gray-900">{coin.symbol}</div>
            <div className="text-xs text-gray-400">{coin.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${chainStyle(coin.chain)}`}>{coin.chain}</span>
          <button onClick={() => setShowNote(s => !s)} className="text-gray-300 hover:text-gray-500 text-xs px-1" title="Add note">📝</button>
          <button onClick={() => onRemove(coin.address)} className="text-gray-300 hover:text-red-400 text-xs px-1" title="Remove">✕</button>
        </div>
      </div>

      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="text-lg font-bold text-gray-900">{formatPrice(coin.price)}</div>
          <div className={`text-xs font-semibold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPos ? '+' : ''}{parseFloat(coin.change24h || 0).toFixed(2)}% (24h)
          </div>
        </div>
        <Sparkline points={coin.sparkline} positive={isPos}/>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-0.5">Volume 24h</div>
          <div className="text-xs font-semibold text-gray-800">{formatNum(coin.volume)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-0.5">Market cap</div>
          <div className="text-xs font-semibold text-gray-800">{formatNum(coin.mcap)}</div>
        </div>
      </div>

      {showNote && (
        <textarea
          value={coin.note || ''}
          onChange={e => onNoteChange(coin.address, e.target.value)}
          placeholder="Why are you watching this? e.g. volume spike, whale activity..."
          className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 resize-none h-16 focus:outline-none focus:border-emerald-400 text-gray-700 mb-2"
        />
      )}

      {coin.alert && (
        <div className="text-xs bg-amber-50 text-amber-700 rounded-lg px-2 py-1 mb-2">
          🔔 Alert set at {formatPrice(coin.alert)}
        </div>
      )}

      <button onClick={() => onBuy(coin)}
        className="w-full bg-gray-900 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
        Trade on Axiom →
      </button>
    </div>
  )
}

function TrendingCard({ pair, onAdd }) {
  const isPos = parseFloat(pair.priceChange?.h24) >= 0
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-bold text-gray-900">{pair.baseToken?.symbol}</div>
          <div className="text-xs text-gray-400">{pair.baseToken?.name}</div>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${chainStyle(pair.chainId)}`}>{pair.chainId}</span>
      </div>
      <div className="text-base font-bold text-gray-900 mb-1">{formatPrice(pair.priceUsd)}</div>
      <div className={`text-xs font-semibold mb-2 ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
        {isPos ? '+' : ''}{pair.priceChange?.h24?.toFixed(2)}% (24h)
      </div>
      <div className="grid grid-cols-2 gap-1 mb-3">
        <div className="text-xs text-gray-400">Vol: <span className="text-gray-700 font-medium">{formatNum(pair.volume?.h24)}</span></div>
        <div className="text-xs text-gray-400">MCap: <span className="text-gray-700 font-medium">{formatNum(pair.marketCap)}</span></div>
      </div>
      <button onClick={() => onAdd(pair)}
        className="w-full bg-emerald-500 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-emerald-600 transition-colors">
        + Watch
      </button>
    </div>
  )
}

export default function MemeCoinTracker({ user }) {
  const [tab, setTab]             = useState('Watchlist')
  const [search, setSearch]       = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult]       = useState(null)
  const [searchError, setSearchError] = useState('')
  const [watchlist, setWatchlist] = useState([])
  const [trending, setTrending]   = useState([])
  const [newListings, setNewListings] = useState([])
  const [loadingTrend, setLoadingTrend] = useState(false)
  const [sortBy, setSortBy]       = useState('added')
  const [alertModal, setAlertModal] = useState(null)
  const [alertPrice, setAlertPrice] = useState('')
  const [saveStatus, setSaveStatus] = useState('')

  // Load watchlist from Supabase on mount
  useEffect(() => {
    async function loadWatchlist() {
      if (!user) return
      const { data } = await supabase.from('profiles').select('watchlist').eq('id', user.id).single()
      if (data?.watchlist && Array.isArray(data.watchlist)) setWatchlist(data.watchlist)
    }
    loadWatchlist()
  }, [user])

  // Save watchlist to Supabase whenever it changes
  async function saveWatchlist(newList) {
    setWatchlist(newList)
    if (!user) return
    setSaveStatus('Saving...')
    await supabase.from('profiles').update({ watchlist: newList }).eq('id', user.id)
    setSaveStatus('✓ Saved')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  // Fetch trending from DexScreener
  async function fetchTrending() {
    setLoadingTrend(true)
    try {
      const res  = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana')
      const data = await res.json()
      const pairs = (data.pairs || [])
        .filter(p => p.volume?.h24 > 10000 && p.priceUsd)
        .sort((a,b) => (b.priceChange?.h24||0) - (a.priceChange?.h24||0))
      setTrending(pairs.slice(0, 12))
      setNewListings(pairs.slice(12, 24))
    } catch(e) {}
    setLoadingTrend(false)
  }

  useEffect(() => {
    if (tab === 'Trending' || tab === 'New Listings') fetchTrending()
  }, [tab])

  // Live price updates every 15s
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
          // Check price alert
          if (coin.alert && coin.price) {
            const oldPrice = parseFloat(coin.price)
            const alertP   = parseFloat(coin.alert)
            if ((oldPrice < alertP && newPrice >= alertP) || (oldPrice > alertP && newPrice <= alertP)) {
              alert(`🔔 Price alert: ${coin.symbol} hit ${formatPrice(alertP)}!`)
            }
          }
          const newSparkline = [...(coin.sparkline || []), newPrice].slice(-20)
          return { ...coin, price: pair.priceUsd, change24h: pair.priceChange?.h24, volume: pair.volume?.h24, sparkline: newSparkline }
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
      if (!data.pairs || data.pairs.length === 0) {
        setSearchError('No coin found. Try a contract address or ticker symbol.')
        setSearching(false); return
      }
      const pair = data.pairs.sort((a,b) => (b.volume?.h24||0) - (a.volume?.h24||0))[0]
      setResult(pair)
    } catch(e) { setSearchError('Failed to fetch. Try again.') }
    setSearching(false)
  }

  function pairToCoin(pair) {
    return {
      name:      pair.baseToken?.name || 'Unknown',
      symbol:    pair.baseToken?.symbol || '?',
      price:     pair.priceUsd,
      change24h: pair.priceChange?.h24,
      volume:    pair.volume?.h24,
      mcap:      pair.marketCap,
      chain:     pair.chainId,
      address:   pair.baseToken?.address,
      dex:       pair.dexId,
      imageUrl:  pair.info?.imageUrl || null,
      sparkline: [parseFloat(pair.priceUsd)],
      note:      '',
      alert:     null,
      addedAt:   Date.now(),
    }
  }

  function addToWatchlist(pair) {
    const coin = pairToCoin(pair)
    const newList = watchlist.find(c => c.address === coin.address)
      ? watchlist
      : [coin, ...watchlist]
    saveWatchlist(newList)
    setResult(null); setSearch('')
  }

  function removeFromWatchlist(address) {
    saveWatchlist(watchlist.filter(c => c.address !== address))
  }

  function updateNote(address, note) {
    const updated = watchlist.map(c => c.address === address ? { ...c, note } : c)
    saveWatchlist(updated)
  }

  function setAlert(address, price) {
    const updated = watchlist.map(c => c.address === address ? { ...c, alert: price } : c)
    saveWatchlist(updated)
    setAlertModal(null); setAlertPrice('')
  }

  function handleBuy(coin) {
    window.open(`https://axiom.trade`, '_blank')
  }

  const sortedWatchlist = [...watchlist].sort((a, b) => {
    if (sortBy === 'change') return parseFloat(b.change24h||0) - parseFloat(a.change24h||0)
    if (sortBy === 'volume') return (b.volume||0) - (a.volume||0)
    if (sortBy === 'mcap')   return (b.mcap||0) - (a.mcap||0)
    return (b.addedAt||0) - (a.addedAt||0)
  })

  return (
    <div>
      {/* Alert Modal */}
      {alertModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full mx-4 shadow-2xl">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Set price alert</h3>
            <p className="text-xs text-gray-400 mb-3">Get notified when {alertModal.symbol} hits this price</p>
            <input value={alertPrice} onChange={e => setAlertPrice(e.target.value)}
              placeholder="e.g. 0.00042"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-emerald-400"/>
            <div className="flex gap-2">
              <button onClick={() => setAlertModal(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg">Cancel</button>
              <button onClick={() => setAlert(alertModal.address, alertPrice)} className="flex-1 bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg">Set alert</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-gray-900">Meme Coin Tracker</div>
            <div className="text-xs text-gray-400">Search any coin — works with Axiom, Pump.fun, Raydium, and all DEXes</div>
          </div>
          {saveStatus && <span className="text-xs text-emerald-600 font-medium">{saveStatus}</span>}
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchCoin()}
            placeholder="Contract address or ticker e.g. PEPE, BONK, WIF..."
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400 text-gray-900 placeholder-gray-400"/>
          <button onClick={searchCoin} disabled={searching}
            className="bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchError && <div className="mt-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{searchError}</div>}

        {result && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {result.info?.imageUrl && <img src={result.info.imageUrl} className="w-8 h-8 rounded-full" alt="" onError={e=>e.target.style.display='none'}/>}
                <div>
                  <span className="text-sm font-bold text-gray-900">{result.baseToken?.name}</span>
                  <span className="ml-2 text-xs text-gray-500">${result.baseToken?.symbol}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${chainStyle(result.chainId)}`}>{result.chainId}</span>
                </div>
              </div>
              <button onClick={() => addToWatchlist(result)}
                className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-600">
                + Add to watchlist
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[['Price', formatPrice(result.priceUsd)],
                ['24h', `${result.priceChange?.h24 >= 0 ? '+' : ''}${result.priceChange?.h24?.toFixed(2)}%`],
                ['Volume', formatNum(result.volume?.h24)],
                ['MCap', formatNum(result.marketCap)]
              ].map(([l, v], i) => (
                <div key={l} className="bg-white rounded-lg p-2">
                  <div className="text-xs text-gray-400 mb-0.5">{l}</div>
                  <div className={`text-sm font-semibold ${i===1 ? (result.priceChange?.h24>=0?'text-emerald-600':'text-red-500') : 'text-gray-900'}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-400">DEX: {result.dexId} · {result.baseToken?.symbol}/{result.quoteToken?.symbol}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${tab===t?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {t} {t==='Watchlist'&&watchlist.length>0?`(${watchlist.length})`:''}
          </button>
        ))}
      </div>

      {/* Watchlist tab */}
      {tab === 'Watchlist' && (
        <>
          {watchlist.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="text-3xl mb-3">👀</div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Your watchlist is empty</div>
              <div className="text-xs text-gray-400">Search for a coin above and add it to start tracking</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">{watchlist.length} coins tracked · updates every 15s</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Sort by:</span>
                  {[['added','Added'],['change','% Change'],['volume','Volume'],['mcap','MCap']].map(([val,label])=>(
                    <button key={val} onClick={()=>setSortBy(val)}
                      className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${sortBy===val?'bg-emerald-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {sortedWatchlist.map((coin, i) => (
                  <div key={i}>
                    <CoinCard
                      coin={coin}
                      onRemove={removeFromWatchlist}
                      onBuy={handleBuy}
                      onNoteChange={updateNote}
                    />
                    <button onClick={() => setAlertModal(coin)}
                      className="w-full mt-1 text-xs text-gray-400 hover:text-amber-600 transition-colors py-1">
                      {coin.alert ? `🔔 Alert: ${formatPrice(coin.alert)}` : '+ Set price alert'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Trending tab */}
      {tab === 'Trending' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">Top gainers on Solana right now</span>
            <button onClick={fetchTrending} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">↻ Refresh</button>
          </div>
          {loadingTrend ? (
            <div className="text-center py-12 text-xs text-gray-400">Loading trending coins...</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {trending.map((pair, i) => (
                <TrendingCard key={i} pair={pair} onAdd={addToWatchlist}/>
              ))}
            </div>
          )}
        </>
      )}

      {/* New Listings tab */}
      {tab === 'New Listings' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">Recently active coins on Solana</span>
            <button onClick={fetchTrending} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">↻ Refresh</button>
          </div>
          {loadingTrend ? (
            <div className="text-center py-12 text-xs text-gray-400">Loading new listings...</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {newListings.map((pair, i) => (
                <TrendingCard key={i} pair={pair} onAdd={addToWatchlist}/>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}