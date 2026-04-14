import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnon    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY

const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  DOGE: 'dogecoin', ADA: 'cardano', XRP: 'ripple', AVAX: 'avalanche-2',
  MATIC: 'matic-network', LINK: 'chainlink', DOT: 'polkadot',
  SHIB: 'shiba-inu', PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk',
  FLOKI: 'floki',
}

const BINANCE_SYMBOLS = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  DOGE: 'DOGEUSDT', AVAX: 'AVAXUSDT', MATIC: 'MATICUSDT',
  PEPE: 'PEPEUSDT', WIF: 'WIFUSDT', BONK: 'BONKUSDT', FLOKI: 'FLOKIUSDT',
}

const CRYPTO_KEYWORDS = [
  'bitcoin','btc','ethereum','eth','solana','sol','crypto','doge','xrp',
  'coinbase','binance','altcoin','memecoin','defi','token','blockchain',
]

function safeNum(val, fallback = 0) {
  const n = Number(val)
  return (isNaN(n) || !isFinite(n)) ? fallback : n
}

function calcEMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0
  const k = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k)
  return ema
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  const rs = gains / (losses || 0.001)
  return 100 - 100 / (1 + rs)
}

function calcMACD(closes) {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macd  = ema12 - ema26
  const signal = macd * 0.9
  return { macd, signal, histogram: macd - signal }
}

function calcSMA(closes, period) {
  if (closes.length < period) return closes[closes.length - 1] || 0
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period
}

function getPriceFromCache(symbol, cachedPrices) {
  if (!cachedPrices || typeof cachedPrices !== 'object') return 0
  if (cachedPrices[symbol]) return safeNum(cachedPrices[symbol])
  const pair = BINANCE_SYMBOLS[symbol]
  if (pair && cachedPrices[pair]) return safeNum(cachedPrices[pair])
  return 0
}

async function fetchOHLC(coinId) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : null
  } catch { return null }
}

async function fetchSpotPrice(coinId) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return safeNum(data?.[coinId]?.usd)
  } catch { return 0 }
}

async function fetchDexScreener(ca) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const pair = data?.pairs?.[0]
    if (!pair) return null
    return {
      price:    safeNum(pair.priceUsd),
      change1h: safeNum(pair.priceChange?.h1),
      change6h: safeNum(pair.priceChange?.h6),
      change24h:safeNum(pair.priceChange?.h24),
      volume24h:safeNum(pair.volume?.h24),
      liquidity:safeNum(pair.liquidity?.usd),
      symbol:   pair.baseToken?.symbol?.toUpperCase() || ca.slice(0, 6),
    }
  } catch { return null }
}

async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1',
      { signal: AbortSignal.timeout(4000) }
    )
    const data = await res.json()
    return data?.data?.[0] || { value: 50, value_classification: 'Neutral' }
  } catch { return { value: 50, value_classification: 'Neutral' } }
}

async function fetchRedditSentiment(coins) {
  try {
    const results = []
    for (const sub of ['CryptoMoonShots', 'SatoshiStreetBets']) {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
        { headers: { 'User-Agent': 'AgentArena/1.0' }, signal: AbortSignal.timeout(4000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const post of data?.data?.children || []) {
        const title = post.data?.title?.toLowerCase() || ''
        const matched = coins.find(c => title.includes(c.toLowerCase()))
        if (matched) results.push({ coin: matched, title: post.data?.title, score: post.data?.score || 0, sub })
      }
    }
    return results
  } catch { return [] }
}

async function fetchPolymarketMarkets() {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?limit=100&active=true',
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return []
    const all = await res.json()
    return (Array.isArray(all) ? all : [])
      .filter(m => CRYPTO_KEYWORDS.some(kw => (m.question || '').toLowerCase().includes(kw)))
      .slice(0, 5)
      .map(m => ({
        id: m.id || m.conditionId,
        question: m.question,
        outcomes: m.outcomes || ['Yes', 'No'],
        outcomePrices: m.outcomePrices || ['0.5', '0.5'],
      }))
  } catch { return [] }
}

async function getClaudeDecision(marketData, openPositions, cashBalance, agentPrompt, fearGreed, redditSignals) {
  const positionsSummary = openPositions.length > 0
    ? openPositions.map(p => {
        const current = marketData[p.coin]
        const changePct = current ? ((current.price - p.entry_price) / p.entry_price * 100).toFixed(2) : '?'
        return `${p.coin}: ${safeNum(p.amount).toFixed(6)} units @ $${safeNum(p.entry_price).toFixed(4)} | Current P&L: ${changePct}%`
      }).join('\n')
    : 'No open positions'

  const marketSummary = Object.entries(marketData)
    .map(([symbol, d]) => {
      const priceStr = d.price > 1 ? d.price.toFixed(2) : d.price.toFixed(8)
      const smaStr   = d.sma6 > 1  ? d.sma6.toFixed(2)  : d.sma6.toFixed(8)
      return `${symbol}: $${priceStr} | RSI: ${d.rsi.toFixed(1)} | MACD hist: ${d.macdHistogram.toFixed(5)} | 6-candle SMA: $${smaStr} | vs SMA: ${d.priceVsSma > 0 ? '+' : ''}${d.priceVsSma.toFixed(2)}%`
    }).join('\n')

  const redditStr = redditSignals.length > 0
    ? redditSignals.map(r => `r/${r.sub}: "${r.title}" (upvotes: ${r.score})`).join('\n')
    : 'No relevant Reddit activity'

  const prompt = `${agentPrompt}

=== LIVE MARKET DATA ===
${marketSummary}

=== FEAR & GREED INDEX ===
${fearGreed.value}/100 — ${fearGreed.value_classification}

=== CURRENT PORTFOLIO ===
Available cash: $${cashBalance.toFixed(2)}
Open positions (${openPositions.length}/${2} max):
${positionsSummary}

=== REDDIT SIGNALS ===
${redditStr}

=== DECISION REQUIRED ===
Based on the data above, return a JSON array of actions to take RIGHT NOW.
Only include coins you want to BUY or CLOSE — omit everything else.

[
  {
    "action": "BUY" or "CLOSE",
    "coin": "SYMBOL",
    "amount_pct": 10,
    "reasoning": "brief explanation referencing specific indicators",
    "confidence": 7
  }
]

Hard rules you MUST follow:
- Max 2 open positions at any time
- Never BUY if RSI > 70 (overbought)
- Never BUY if Fear & Greed < 20 (extreme fear)
- Never BUY if price is below 6-candle SMA (no trend support)
- CLOSE if position is down more than 8% (stop loss)
- CLOSE if position is up more than 20% (take profit)
- CLOSE if RSI > 75 on an open position
- amount_pct must be between 5 and 15
- confidence must be between 1 and 10

Return ONLY the JSON array. No text before or after.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.text || '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    const decisions = JSON.parse(jsonMatch[0])
    return Array.isArray(decisions) ? decisions : []
  } catch (err) {
    console.error('Claude decision error:', err.message)
    return []
  }
}

// Research a Polymarket question using Claude + web search before betting
async function researchPolymarketBet(market, fearGreed) {
  try {
    const question = market.question || ''
    const outcomes = market.outcomes || ['Yes', 'No']
    const prices   = market.outcomePrices || ['0.5', '0.5']
    const oddsStr  = outcomes.map((o, i) => `${o}: ${(safeNum(prices[i]) * 100).toFixed(0)}%`).join(', ')

    const prompt = `You are a prediction market analyst with access to web search. Research this crypto prediction market question thoroughly before deciding.

QUESTION: "${question}"
CURRENT ODDS: ${oddsStr}
FEAR & GREED: ${fearGreed.value} (${fearGreed.value_classification})

Search for recent news and data relevant to this question. Then decide:
1. Which outcome is most likely based on current evidence?
2. Is the market mispriced (is one outcome undervalued)?

Respond with ONLY this JSON (no other text):
{"outcome":"${outcomes[0]}","confidence":7,"reasoning":"brief reason citing evidence","bet":true}

Rules:
- Use web search to find relevant recent news first
- Only set bet:true if confidence >= 7
- Pick the outcome you genuinely believe is more likely based on evidence`

    // Use web search tool for research
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    })

    // Extract the final text response (after tool use)
    const textBlock = response.content.find(b => b.type === 'text')
    const text = textBlock?.text || '{}'
    const jsonMatch = text.match(/\{[^{}]*\}/)
    if (!jsonMatch) return { outcome: null, odds: 0.5, confidence: 0 }

    const decision = JSON.parse(jsonMatch[0])
    if (!decision.bet || decision.confidence < 7) return { outcome: null, odds: 0.5, confidence: 0 }

    const idx  = outcomes.indexOf(decision.outcome)
    const odds = idx >= 0 ? safeNum(prices[idx], 0.5) : 0.5

    return {
      outcome:    decision.outcome,
      odds,
      confidence: decision.confidence,
      reasoning:  decision.reasoning || 'Researched via web search',
    }
  } catch (err) {
    console.error('Polymarket research error:', err.message)
    return { outcome: null, odds: 0.5, confidence: 0 }
  }
}
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const userToken  = authHeader.replace('Bearer ', '').trim()

    const supabase = createClient(
      supabaseUrl,
      supabaseService || supabaseAnon,
      supabaseService ? {} : (userToken ? {
        global: { headers: { Authorization: `Bearer ${userToken}` } }
      } : {})
    )

    const body = await request.json()
    const {
      agentId,
      userId,
      coins = [],
      riskSettings = {},
      cachedPrices = {},
      customCoinCas = {},
      openPositions: clientOpenPositions = [],
      portfolioValue: clientPortfolioValue = 10000,
      prompt: agentPrompt = '',
      forumSettings = {},
      manualAction = null,
    } = body

    // ── Handle manual buy/close from UI ────────────────────────────────
    if (manualAction) {
      const { action, coin, price, amount_pct = 10 } = manualAction
      const symbol = coin?.toUpperCase()

      const { data: agentManual } = await supabase
        .from('agents').select('cash_balance, invested_value, polymarket_balance, portfolio_value')
        .eq('id', agentId).maybeSingle()

      let cash     = safeNum(agentManual?.cash_balance, 10000)
      let invested = safeNum(agentManual?.invested_value, 0)
      let poly     = safeNum(agentManual?.polymarket_balance, 0)

      if (action === 'BUY') {
        const tradeUSD = (cash * amount_pct) / 100
        const units    = tradeUSD / price
        if (cash >= tradeUSD && units > 0) {
          cash    -= tradeUSD
          invested += tradeUSD
          await supabase.from('trades').insert({
            agent_id: agentId, user_id: userId, coin: symbol, type: 'buy',
            entry_price: parseFloat(price.toFixed(8)), amount: parseFloat(units.toFixed(8)),
            status: 'open', reasoning: `Manual BUY @ $${price.toFixed(4)}`,
          })
        }
      }

      const { data: stillOpen } = await supabase
        .from('trades').select('entry_price, amount').eq('agent_id', agentId).eq('status', 'open')
      invested = (stillOpen || []).reduce((s, t) => s + safeNum(t.entry_price) * safeNum(t.amount), 0)

      const total = cash + invested + poly
      const ret   = parseFloat((((total - 10000) / 10000) * 100).toFixed(2))
      await supabase.from('agents').update({
        cash_balance: parseFloat(cash.toFixed(4)), invested_value: parseFloat(invested.toFixed(4)),
        portfolio_value: parseFloat(total.toFixed(4)), total_return: ret,
      }).eq('id', agentId)

      return NextResponse.json({ success: true, portfolio: { cash, invested, polymarket: poly, total }, action, coin: symbol, price })
    }

    const { data: agentRow } = await supabase
      .from('agents')
      .select('cash_balance, invested_value, polymarket_balance, portfolio_value, prompt')
      .eq('id', agentId)
      .maybeSingle()

    let polyBalance   = safeNum(agentRow?.polymarket_balance, 0)
    const savedPrompt = agentRow?.prompt || agentPrompt || ''

    // Load all open trades first
    const { data: openTradesDB } = await supabase
      .from('trades').select('*').eq('agent_id', agentId).eq('status', 'open')

    const openPositions = openTradesDB?.length ? openTradesDB : (clientOpenPositions || [])

    // Recalculate investedValue as sum of (entry_price * amount) for all open positions
    // This is the ground truth — never trust the stale DB invested_value
    let investedValue = openPositions.reduce((sum, p) => {
      return sum + safeNum(p.entry_price) * safeNum(p.amount)
    }, 0)

    // Recalculate cashBalance as: starting $10,000 minus all money currently tied up
    // This prevents the double-counting bug where cash inflates on close
    const { data: allTrades } = await supabase
      .from('trades').select('entry_price, amount, pnl, status').eq('agent_id', agentId)

    const startingBalance = 10000
    const totalInvested   = (allTrades || [])
      .filter(t => t.status === 'open')
      .reduce((sum, t) => sum + safeNum(t.entry_price) * safeNum(t.amount), 0)

    const totalRealised = (allTrades || [])
      .filter(t => t.status === 'closed')
      .reduce((sum, t) => sum + safeNum(t.pnl), 0)

    let cashBalance = startingBalance + totalRealised - totalInvested - polyBalance
    cashBalance = Math.max(0, cashBalance)
    investedValue = totalInvested
    const stopLossPct   = safeNum(riskSettings.stopLoss, 8)
    const takeProfitPct = safeNum(riskSettings.takeProfit, 20)
    const maxPositions  = safeNum(riskSettings.maxPositions, 2)

    const fearGreed = await fetchFearGreed()

    // ── Gather market data ──────────────────────────────────────────────
    const marketData = {}
    const coinList   = Array.isArray(coins) ? coins : []

    for (const coin of coinList) {
      const symbol = coin.toUpperCase()
      const coinId = COINGECKO_IDS[symbol]
      if (!coinId) continue

      let price = getPriceFromCache(symbol, cachedPrices)
      let rsi = 50, macdHistogram = 0, sma6 = 0, priceVsSma = 0

      const ohlc = await fetchOHLC(coinId)
      if (ohlc && ohlc.length > 0) {
        const closes = ohlc.map(c => safeNum(c[4])).filter(p => p > 0)
        if (closes.length > 0) {
          rsi           = calcRSI(closes)
          macdHistogram = calcMACD(closes).histogram
          sma6          = calcSMA(closes, 6)
          if (!price || price <= 0) price = closes[closes.length - 1]
          priceVsSma = sma6 > 0 ? ((price - sma6) / sma6) * 100 : 0
        }
      }

      if (!price || price <= 0) price = await fetchSpotPrice(coinId)
      if (!price || price <= 0) continue

      marketData[symbol] = { price, rsi, macdHistogram, sma6, priceVsSma }
    }

    // ── Reddit sentiment ────────────────────────────────────────────────
    let redditSignals = []
    if (forumSettings?.reddit && coinList.length > 0) {
      redditSignals = await fetchRedditSentiment(coinList)
    }

    // ── Claude makes the decisions ──────────────────────────────────────
    const decisions = await getClaudeDecision(
      marketData, openPositions, cashBalance, savedPrompt, fearGreed, redditSignals
    )

    const tradeResults = []

    for (const decision of decisions) {
      const { action, coin, amount_pct, reasoning, confidence } = decision
      const symbol = coin?.toUpperCase()
      if (!symbol || !marketData[symbol]) continue

      const price   = marketData[symbol].price
      const openPos = openPositions.find(p => p.coin === symbol)

      if (action === 'BUY' && !openPos) {
        if (openPositions.filter(p => !tradeResults.find(t => t.action === 'CLOSE' && t.coin === p.coin)).length >= maxPositions) continue
        if (safeNum(fearGreed.value) < 20) continue
        if (marketData[symbol].rsi > 70) continue

        const pct          = Math.min(Math.max(safeNum(amount_pct, 10), 5), 15)
        const tradeSizeUSD = (cashBalance * pct) / 100
        const units        = tradeSizeUSD / price

        if (cashBalance < tradeSizeUSD || tradeSizeUSD < 5 || units <= 0) continue

        cashBalance   -= tradeSizeUSD
        investedValue += tradeSizeUSD

        await supabase.from('trades').insert({
          agent_id: agentId, user_id: userId, coin: symbol, type: 'buy',
          entry_price: parseFloat(price.toFixed(8)),
          amount:      parseFloat(units.toFixed(8)),
          status:      'open',
          reasoning:   reasoning || `BUY ${symbol} @ $${price.toFixed(4)}`,
        })

        tradeResults.push({ action: 'BUY', coin: symbol, price, amount: units, confidence, reasoning })
        openPositions.push({ coin: symbol, entry_price: price, amount: units, status: 'open' })
      }

      if (action === 'CLOSE' && openPos) {
        const entryPrice = safeNum(openPos.entry_price, price)
        const posUnits   = safeNum(openPos.amount, 0)
        const pnl        = (price - entryPrice) * posUnits
        const returned   = (entryPrice * posUnits) + pnl

        cashBalance   += returned
        investedValue  = Math.max(0, investedValue - (entryPrice * posUnits))

        await supabase.from('trades').update({
          status: 'closed', exit_price: parseFloat(price.toFixed(8)),
          pnl: parseFloat(pnl.toFixed(4)), closed_at: new Date().toISOString(),
          reasoning: reasoning || `CLOSE ${symbol} @ $${price.toFixed(4)}, P&L: $${pnl.toFixed(2)}`,
        }).eq('id', openPos.id)

        tradeResults.push({ action: 'CLOSE', coin: symbol, price, pnl, confidence, reasoning, trade: { pnl } })
      }
    }

    // ── Hard stop-loss / take-profit override ───────────────────────────
    for (const pos of openPositions) {
      if (!pos.id || !marketData[pos.coin]) continue
      if (tradeResults.find(t => t.coin === pos.coin)) continue

      const price      = marketData[pos.coin].price
      const entryPrice = safeNum(pos.entry_price, price)
      const changePct  = entryPrice > 0 ? ((price - entryPrice) / entryPrice) * 100 : 0

      if (changePct <= -stopLossPct || changePct >= takeProfitPct) {
        const posUnits = safeNum(pos.amount, 0)
        const pnl      = (price - entryPrice) * posUnits
        cashBalance   += (entryPrice * posUnits) + pnl
        investedValue  = Math.max(0, investedValue - (entryPrice * posUnits))

        await supabase.from('trades').update({
          status: 'closed', exit_price: parseFloat(price.toFixed(8)),
          pnl: parseFloat(pnl.toFixed(4)), closed_at: new Date().toISOString(),
          reasoning: changePct <= -stopLossPct
            ? `STOP LOSS @ $${price.toFixed(4)} (${changePct.toFixed(1)}%)`
            : `TAKE PROFIT @ $${price.toFixed(4)} (+${changePct.toFixed(1)}%)`,
        }).eq('id', pos.id)

        tradeResults.push({ action: 'CLOSE', coin: pos.coin, price, pnl,
          reasoning: changePct <= -stopLossPct ? 'Stop loss' : 'Take profit', trade: { pnl } })
      }
    }

    // ── Custom CA meme coins ────────────────────────────────────────────
    const caEntries = typeof customCoinCas === 'object' && !Array.isArray(customCoinCas)
      ? Object.entries(customCoinCas) : []

    for (const [, ca] of caEntries) {
      if (!ca) continue
      const dex = await fetchDexScreener(ca)
      if (!dex || !dex.price || dex.price <= 0) continue

      const { symbol, price, change1h, change6h, change24h, volume24h, liquidity } = dex
      const openPos = openPositions.find(t => t.coin === symbol)

      let bullish = 0
      if (change1h  >  5)  bullish++   // stronger 1h momentum required
      if (change6h  > 12)  bullish++   // stronger 6h momentum
      if (change24h > 20)  bullish++   // stronger 24h momentum
      if (volume24h > 100000) bullish++ // higher volume threshold
      if (liquidity > 50000)  bullish++ // higher liquidity requirement

      // Also check bearish signals that cancel the trade
      let bearish = 0
      if (change1h  < -3) bearish++
      if (change24h < -5) bearish++

      const netSignals = bullish - bearish

      // Only buy if very strong signal, no existing position, and not already bought recently
      const recentBuy = openPositions.find(p => p.coin === symbol)
      if (!openPos && !recentBuy && netSignals >= 4 && openPositions.length < maxPositions && cashBalance > 200) {
        const tradeSizeUSD = (cashBalance * 8) / 100
        const units = tradeSizeUSD / price
        cashBalance -= tradeSizeUSD; investedValue += tradeSizeUSD

        await supabase.from('trades').insert({
          agent_id: agentId, user_id: userId, coin: symbol, type: 'buy',
          entry_price: parseFloat(price.toFixed(8)), amount: parseFloat(units.toFixed(8)),
          status: 'open',
          reasoning: `MEME BUY — ${bullish}/5 signals. 1h:${change1h}% 24h:${change24h}%`,
        })
        tradeResults.push({ action: 'BUY', coin: symbol, price, amount: units, meme: true })
      }

      if (openPos) {
        const entryPrice = safeNum(openPos.entry_price, price)
        const changePct  = entryPrice > 0 ? ((price - entryPrice) / entryPrice) * 100 : 0
        if (changePct >= takeProfitPct || changePct <= -stopLossPct) {
          const posUnits = safeNum(openPos.amount, 0)
          const pnl = (price - entryPrice) * posUnits
          cashBalance += (entryPrice * posUnits) + pnl
          investedValue = Math.max(0, investedValue - (entryPrice * posUnits))
          await supabase.from('trades').update({
            status: 'closed', exit_price: parseFloat(price.toFixed(8)),
            pnl: parseFloat(pnl.toFixed(4)), closed_at: new Date().toISOString(),
          }).eq('id', openPos.id)
          tradeResults.push({ action: 'CLOSE', coin: symbol, price, pnl })
        }
      }
    }

    // ── Polymarket ──────────────────────────────────────────────────────
    let polyResult = null
    try {
      const markets = await fetchPolymarketMarkets()
      if (markets.length > 0) {
        const { data: openBets } = await supabase
          .from('polymarket_bets').select('id, stake, created_at, odds, potential_payout')
          .eq('agent_id', agentId).eq('status', 'open')

        for (const bet of openBets || []) {
          if ((Date.now() - new Date(bet.created_at).getTime()) / 86400000 > 7) {
            const won = Math.random() < safeNum(bet.odds, 0.5)
            const pnl = won ? bet.potential_payout - bet.stake : -bet.stake
            await supabase.from('polymarket_bets').update({
              status: 'resolved', result: won ? 'win' : 'loss',
              pnl: parseFloat(pnl.toFixed(2)), resolved_at: new Date().toISOString(),
            }).eq('id', bet.id)
            polyBalance = Math.max(0, polyBalance - bet.stake)
            if (won) cashBalance += bet.potential_payout
          }
        }

        const activeBets = (openBets || []).filter(b =>
          (Date.now() - new Date(b.created_at).getTime()) / 86400000 <= 7
        )

        if (activeBets.length < 2 && Math.random() < 0.2 && cashBalance > 200) {
          const market  = markets[Math.floor(Math.random() * markets.length)]

          // Research the market question using Claude before betting
          const betResearch = await researchPolymarketBet(market, fearGreed)
          if (betResearch.outcome) {
          const { outcome, odds } = betResearch

          const stake   = parseFloat(Math.min(cashBalance * 0.03, 150).toFixed(2))
          const payout  = parseFloat((stake / Math.max(odds, 0.01)).toFixed(2))

          cashBalance -= stake; polyBalance += stake

          const { error: betErr } = await supabase.from('polymarket_bets').insert({
            agent_id: agentId, user_id: userId,
            market_id: market.id, question: market.question,
            outcome, odds, stake, potential_payout: payout, status: 'open',
            reasoning: `${(odds*100).toFixed(0)}% implied prob. Payout: $${payout.toFixed(0)}`,
          })

          if (!betErr) {
            polyResult = { action: 'BET', market: market.question, outcome, stake, odds, potential_payout: payout }
          } else { cashBalance += stake; polyBalance -= stake }
          } // end if betResearch.outcome
        }
      }
    } catch {}

    // ── Recalculate investedValue from actual open positions ───────────
    // This ensures invested is always accurate, not relying on stale DB value
    const { data: stillOpen } = await supabase
      .from('trades').select('entry_price, amount').eq('agent_id', agentId).eq('status', 'open')

    investedValue = (stillOpen || []).reduce((sum, t) => {
      return sum + safeNum(t.entry_price) * safeNum(t.amount)
    }, 0)

    // ── Update agent ────────────────────────────────────────────────────
    const { data: allClosed } = await supabase
      .from('trades').select('pnl').eq('agent_id', agentId).eq('status', 'closed')

    const wins     = allClosed?.filter(t => safeNum(t.pnl) > 0).length || 0
    const winRate  = allClosed?.length > 0 ? parseFloat(((wins / allClosed.length) * 100).toFixed(1)) : 0
    const total    = cashBalance + investedValue + polyBalance
    const ret      = parseFloat((((total - 10000) / 10000) * 100).toFixed(2))

    await supabase.from('agents').update({
      cash_balance:       parseFloat(Math.max(0, cashBalance).toFixed(4)),
      invested_value:     parseFloat(Math.max(0, investedValue).toFixed(4)),
      polymarket_balance: parseFloat(Math.max(0, polyBalance).toFixed(4)),
      portfolio_value:    parseFloat(total.toFixed(4)),
      win_rate:           winRate,
      total_return:       ret,
      status:             'active',
    }).eq('id', agentId)

    const firstTrade = tradeResults[0]
    return NextResponse.json({
      action:     firstTrade?.action || 'HOLD',
      coin:       firstTrade?.coin   || null,
      price:      firstTrade?.price  || null,
      amount:     firstTrade?.amount || null,
      confidence: firstTrade?.confidence || 7,
      reasoning:  tradeResults.length
        ? tradeResults.map(t => `${t.action} ${t.coin}`).join(', ')
        : 'Claude analysed all indicators — no strong entry signals.',
      trade:      firstTrade?.pnl != null ? { pnl: firstTrade.pnl } : null,
      success:    true,
      trades:     tradeResults,
      polymarket: polyResult,
      fearGreed,
      portfolio:  { cash: cashBalance, invested: investedValue, polymarket: polyBalance, total, winRate },
    })

  } catch (err) {
    console.error('Trade route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}