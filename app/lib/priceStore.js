// Central price store — fetches once every 10s, all agents read from it

const COINGECKO_IDS = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  SOL:   'solana',
  BNB:   'binancecoin',
  AVAX:  'avalanche-2',
  MATIC: 'polygon-ecosystem-token',
  DOGE:  'dogecoin',
  PEPE:  'pepe',
  WIF:   'dogwifcoin',
  BONK:  'bonk',
  FLOKI: 'floki',
  MEME:  'solana',
}

// $AGENT CA — swap for real CA at launch
const AGENT_CA = 'PLACEHOLDER_AGENT_CA'

// Custom CAs registered by agents: { symbol: ca }
let customCAs = {}

const ALL_IDS = [...new Set(Object.values(COINGECKO_IDS))].join(',')

let store = {
  prices:     {},
  changes:    {},
  raw:        {},
  lastUpdate: null,
  listeners:  new Set(),
}

let fetchInterval = null

function notify() {
  store.listeners.forEach(fn => fn({ ...store }))
}

function fmtPrice(p) {
  if (!p) return '0'
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
  if (p >= 1)    return p.toFixed(2)
  if (p >= 0.01) return p.toFixed(4)
  return p.toFixed(8)
}

async function fetchDexScreener(ca) {
  try {
    const res  = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`)
    const data = await res.json()
    const pair = data?.pairs?.[0]
    if (!pair) return null
    return {
      price:     parseFloat(pair.priceUsd || 0),
      change24h: parseFloat(pair.priceChange?.h24 || 0),
      high24h:   parseFloat(pair.priceUsd || 0),
      low24h:    parseFloat(pair.priceUsd || 0),
      volume:    parseFloat(pair.volume?.h24 || 0),
    }
  } catch { return null }
}

async function fetchAll() {
  try {
    // Fetch CoinGecko + AGENT + all custom CAs in parallel
    const customSymbols = Object.keys(customCAs)
    const agentFetch    = AGENT_CA !== 'PLACEHOLDER_AGENT_CA' ? fetchDexScreener(AGENT_CA) : Promise.resolve(null)
    const customFetches = customSymbols.map(sym => fetchDexScreener(customCAs[sym]))

    const [cgRes, agentData, ...customResults] = await Promise.all([
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ALL_IDS}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24hr=true&include_low_24hr=true`),
      agentFetch,
      ...customFetches,
    ])

    const data = await cgRes.json()
    const prices = {}, changes = {}, raw = {}

    // CoinGecko coins
    for (const [coin, id] of Object.entries(COINGECKO_IDS)) {
      if (data[id]) {
        const p = data[id].usd || 0
        const c = data[id].usd_24h_change || 0
        prices[coin]  = fmtPrice(p)
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

    // $AGENT
    if (agentData) {
      prices['AGENT']  = fmtPrice(agentData.price)
      changes['AGENT'] = agentData.change24h.toFixed(2)
      raw['AGENT']     = agentData
    } else {
      prices['AGENT']  = prices['SOL'] || '...'
      changes['AGENT'] = changes['SOL'] || '0.00'
      raw['AGENT']     = raw['SOL'] || {}
    }

    // Custom CA coins
    customSymbols.forEach((sym, i) => {
      const d = customResults[i]
      if (d) {
        prices[sym]  = fmtPrice(d.price)
        changes[sym] = d.change24h.toFixed(2)
        raw[sym]     = d
      }
    })

    store.prices     = prices
    store.changes    = changes
    store.raw        = raw
    store.lastUpdate = Date.now()
    notify()
  } catch (e) {
    console.error('priceStore fetch error:', e)
  }
}

// Register a custom CA so priceStore fetches it on every cycle
export function registerCustomCA(symbol, ca) {
  if (!symbol || !ca) return
  customCAs[symbol] = ca
}

export function unregisterCustomCA(symbol) {
  delete customCAs[symbol]
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