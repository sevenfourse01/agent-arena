// priceStore.js — uses Binance WebSocket for live prices (no rate limits)
// Falls back to REST on connection failure

const SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT',
  'AVAXUSDT','MATICUSDT','PEPEUSDT','WIFUSDT','BONKUSDT','FLOKIUSDT',
]

const SYMBOL_TO_COIN = {
  BTCUSDT:'BTC', ETHUSDT:'ETH', SOLUSDT:'SOL', BNBUSDT:'BNB',
  DOGEUSDT:'DOGE', AVAXUSDT:'AVAX', MATICUSDT:'MATIC',
  PEPEUSDT:'PEPE', WIFUSDT:'WIF', BONKUSDT:'BONK', FLOKIUSDT:'FLOKI',
}

let ws            = null
let subscribers   = []
let prices        = {}
let changes       = {}
let customCAs     = {}
let running       = false
let restInterval  = null
let reconnectTimer = null

function formatPrice(n) {
  if (!n) return '0'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1)    return n.toFixed(2)
  if (n >= 0.01) return n.toFixed(4)
  return n.toFixed(8)
}

function notify() {
  const snapshot = { prices: { ...prices }, changes: { ...changes } }
  subscribers.forEach(fn => { try { fn(snapshot) } catch {} })
}

// ── Binance WebSocket ─────────────────────────────────────────────────────────
function connectWebSocket() {
  if (typeof window === 'undefined') return
  if (ws && ws.readyState === WebSocket.OPEN) return

  try {
    const streams = SYMBOLS.map(s => `${s.toLowerCase()}@ticker`).join('/')
    ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)

    ws.onmessage = (e) => {
      try {
        const msg  = JSON.parse(e.data)
        const data = msg.data
        if (!data?.s) return
        const coin   = SYMBOL_TO_COIN[data.s]
        if (!coin) return
        const price  = parseFloat(data.c)  // last price
        const change = parseFloat(data.P)  // 24h change %
        if (isNaN(price)) return
        prices[coin]  = formatPrice(price)
        changes[coin] = isNaN(change) ? '0.00' : change.toFixed(2)
        notify()
      } catch {}
    }

    ws.onopen = () => {
      console.log('PriceStore: WebSocket connected')
      // Stop REST polling since WS is working
      if (restInterval) { clearInterval(restInterval); restInterval = null }
    }

    ws.onclose = () => {
      console.log('PriceStore: WebSocket closed, reconnecting in 5s...')
      ws = null
      if (running) {
        reconnectTimer = setTimeout(() => {
          connectWebSocket()
        }, 5000)
        // Start REST fallback while reconnecting
        startRestFallback()
      }
    }

    ws.onerror = () => {
      ws?.close()
    }
  } catch (err) {
    console.error('PriceStore WebSocket error:', err)
    startRestFallback()
  }
}

// ── REST Fallback (used when WS fails) ───────────────────────────────────────
async function fetchPricesRest() {
  try {
    const ids = 'bitcoin,ethereum,solana,binancecoin,dogecoin,avalanche-2,matic-network,pepe,dogwifcoin,bonk,floki'
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return
    const data = await res.json()

    const map = {
      bitcoin:'BTC', ethereum:'ETH', solana:'SOL', binancecoin:'BNB',
      dogecoin:'DOGE', 'avalanche-2':'AVAX', 'matic-network':'MATIC',
      pepe:'PEPE', dogwifcoin:'WIF', bonk:'BONK', floki:'FLOKI',
    }

    Object.entries(map).forEach(([id, coin]) => {
      if (data[id]?.usd) {
        prices[coin]  = formatPrice(data[id].usd)
        changes[coin] = (data[id].usd_24h_change || 0).toFixed(2)
      }
    })
    notify()
  } catch {}
}

function startRestFallback() {
  if (restInterval) return
  fetchPricesRest() // immediate fetch
  restInterval = setInterval(fetchPricesRest, 30000) // every 30s
}

// ── Custom CA tokens (DexScreener) ───────────────────────────────────────────
async function fetchCustomCA(symbol, ca) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`)
    if (!res.ok) return
    const data = await res.json()
    const pair = data?.pairs?.[0]
    if (!pair) return
    const price  = parseFloat(pair.priceUsd || 0)
    const change = parseFloat(pair.priceChange?.h24 || 0)
    if (!price) return
    prices[symbol]  = formatPrice(price)
    changes[symbol] = change.toFixed(2)
    notify()
  } catch {}
}

let caInterval = null
function startCAPolling() {
  if (caInterval) clearInterval(caInterval)
  caInterval = setInterval(() => {
    Object.entries(customCAs).forEach(([sym, ca]) => fetchCustomCA(sym, ca))
  }, 30000)
  // Immediate fetch
  Object.entries(customCAs).forEach(([sym, ca]) => fetchCustomCA(sym, ca))
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startPriceStore() {
  if (running) return
  running = true
  connectWebSocket()
  // Small delay then start REST as backup in case WS takes time
  setTimeout(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      startRestFallback()
    }
  }, 3000)
}

export function stopPriceStore() {
  running = false
  if (ws) { ws.close(); ws = null }
  if (restInterval) { clearInterval(restInterval); restInterval = null }
  if (caInterval) { clearInterval(caInterval); caInterval = null }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
}

export function subscribePrices(fn) {
  subscribers.push(fn)
  // Send current prices immediately if available
  if (Object.keys(prices).length > 0) {
    fn({ prices: { ...prices }, changes: { ...changes } })
  }
  return () => { subscribers = subscribers.filter(s => s !== fn) }
}

export function getRawPrices() {
  return { ...prices }
}

export function registerCustomCA(symbol, ca) {
  if (!symbol || !ca) return
  customCAs[symbol] = ca
  fetchCustomCA(symbol, ca) // immediate
  if (!caInterval) startCAPolling()
}

export function unregisterCustomCA(symbol) {
  delete customCAs[symbol]
  delete prices[symbol]
  delete changes[symbol]
}