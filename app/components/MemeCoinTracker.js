'use client'
import { useState, useEffect } from 'react'

export default function MemeCoinTracker({ onAddToAgent }) {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [watchlist, setWatchlist] = useState([])

  async function searchCoin() {
    if (!search.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${search.trim()}`)
      const data = await res.json()
      if (!data.pairs || data.pairs.length === 0) {
        setError('No coin found. Try a contract address or ticker symbol.')
        setLoading(false)
        return
      }
      const pair = data.pairs.sort((a,b) => (b.volume?.h24||0) - (a.volume?.h24||0))[0]
      setResult(pair)
    } catch(e) {
      setError('Failed to fetch. Check the contract address and try again.')
    }
    setLoading(false)
  }

  function addToWatchlist() {
    if (!result) return
    const coin = {
      name: result.baseToken?.name || 'Unknown',
      symbol: result.baseToken?.symbol || '?',
      price: result.priceUsd,
      change24h: result.priceChange?.h24,
      volume: result.volume?.h24,
      mcap: result.marketCap,
      chain: result.chainId,
      address: result.baseToken?.address,
      dex: result.dexId,
    }
    setWatchlist(prev => {
      if (prev.find(c => c.address === coin.address)) return prev
      return [coin, ...prev]
    })
    if (onAddToAgent) onAddToAgent(coin)
    setResult(null)
    setSearch('')
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      if (watchlist.length === 0) return
      const updated = await Promise.all(watchlist.map(async coin => {
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${coin.address}`)
          const data = await res.json()
          const pair = data.pairs?.[0]
          if (!pair) return coin
          return { ...coin, price: pair.priceUsd, change24h: pair.priceChange?.h24, volume: pair.volume?.h24 }
        } catch { return coin }
      }))
      setWatchlist(updated)
    }, 15000)
    return () => clearInterval(interval)
  }, [watchlist])

  function formatNum(n) {
    if (!n) return '—'
    if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B'
    if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M'
    if (n >= 1e3) return '$' + (n/1e3).toFixed(2) + 'K'
    return '$' + parseFloat(n).toFixed(2)
  }

  function formatPrice(p) {
    if (!p) return '—'
    const n = parseFloat(p)
    if (n < 0.000001) return '$' + n.toExponential(2)
    if (n < 0.01) return '$' + n.toFixed(8)
    if (n < 1) return '$' + n.toFixed(6)
    return '$' + n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:4})
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-medium mb-3">Meme coin tracker</div>
        <div className="text-xs text-gray-400 mb-3">Paste any contract address or search by ticker — works with Axiom, Pump.fun, Raydium, and all DEXes</div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchCoin()}
            placeholder="Contract address or ticker e.g. PEPE, BONK, or 0x..."
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-emerald-400"/>
          <button onClick={searchCoin} disabled={loading}
            className="bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {result && (
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium">{result.baseToken?.name}</span>
                <span className="ml-2 text-xs text-gray-400">${result.baseToken?.symbol}</span>
                <span className="ml-2 text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">{result.chainId}</span>
              </div>
              <button onClick={addToWatchlist}
                className="bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                + Add to watchlist
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Price</div>
                <div className="text-sm font-medium">{formatPrice(result.priceUsd)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">24h change</div>
                <div className={`text-sm font-medium ${result.priceChange?.h24 >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {result.priceChange?.h24 >= 0 ? '+' : ''}{result.priceChange?.h24?.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">24h volume</div>
                <div className="text-sm font-medium">{formatNum(result.volume?.h24)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Market cap</div>
                <div className="text-sm font-medium">{formatNum(result.marketCap)}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              DEX: {result.dexId} · Pair: {result.baseToken?.symbol}/{result.quoteToken?.symbol}
            </div>
          </div>
        )}
      </div>

      {watchlist.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">Watchlist — agent monitoring these</div>
          <div className="flex flex-col gap-0">
            {watchlist.map((coin, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{coin.name}</span>
                    <span className="text-xs text-gray-400">${coin.symbol}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{coin.chain}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Vol: {formatNum(coin.volume)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatPrice(coin.price)}</div>
                  <div className={`text-xs font-medium ${coin.change24h >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {coin.change24h >= 0 ? '+' : ''}{coin.change24h?.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}