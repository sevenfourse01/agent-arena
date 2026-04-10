// Central price store — fetches once every 10s, all agents read from it

const COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  AGENT: 'solana',
  MEME: 'solana',
}

const ALL_IDS = [...new Set(Object.values(COINGECKO_IDS))].join(',')

let store = {
  prices:    {},  // { BTC: '68,123.45', ETH: '2,103.00', ... }
  changes:   {},  // { BTC: '-0.55', ETH: '-1.42', ... }
  raw:       {},  // { BTC: { price, change24h, high24h, low24h, volume }, ... }
  lastUpdate: null,
  listeners: new Set(),
}

let fetchInterval = null

function notify() {
  store.listeners.forEach(fn => fn({ ...store }))
}

async function fetchAll() {
  try {
    const res  = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ALL_IDS}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24hr=true&include_low_24hr=true`
    )
    const data = await res.json()
    const prices = {}, changes = {}, raw = {}

    for (const [coin, id] of Object.entries(COINGECKO_IDS)) {
      if (data[id]) {
        const p = data[id].usd || 0
        const c = data[id].usd_24h_change || 0
        prices[coin]  = p >= 1000
          ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : p.toFixed(p >= 1 ? 2 : 4)
        changes[coin] = c.toFixed(2)
        raw[coin] = {
          price:     p,
          change24h: c,
          high24h:   data[id].usd_24h_high || p,
          low24h:    data[id].usd_24h_low  || p,
          volume:    data[id].usd_24h_vol  || 0,
        }
      }
    }

    store.prices    = prices
    store.changes   = changes
    store.raw       = raw
    store.lastUpdate = Date.now()
    notify()
  } catch (e) {
    console.error('priceStore fetch error:', e)
  }
}

export function startPriceStore() {
  if (fetchInterval) return
  fetchAll()
  fetchInterval = setInterval(fetchAll, 10000)
}

export function stopPriceStore() {
  if (fetchInterval) { clearInterval(fetchInterval); fetchInterval = null }
}

export function subscribePrices(fn) {
  store.listeners.add(fn)
  if (Object.keys(store.prices).length) fn({ ...store })
  return () => store.listeners.delete(fn)
}

export function getRawPrices() {
  return store.raw
}