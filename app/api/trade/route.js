import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COINGECKO_IDS = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  SOL:   'solana',
  BNB:   'binancecoin',
  AVAX:  'avalanche-2',
  MATIC: 'matic-network',
  DOGE:  'dogecoin',
  SHIB:  'shiba-inu',
  PEPE:  'pepe',
  WIF:   'dogwifcoin',
  BONK:  'bonk',
  FLOKI: 'floki',
  AGENT: 'solana',
  MEME:  'solana',
}

// Server-side price cache
let serverPriceCache = {}
let serverCacheTime  = 0

async function fetchPricesFromCoinGecko(coins) {
  const now = Date.now()
  if (Object.keys(serverPriceCache).length && now - serverCacheTime < 60000) {
    return serverPriceCache
  }
  try {
    const uniqueCoins = [...new Set(coins.filter(c => COINGECKO_IDS[c]))]
    const ids = [...new Set(uniqueCoins.map(c => COINGECKO_IDS[c]))].join(',')
    const res  = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24hr=true&include_low_24hr=true`
    )
    const data = await res.json()
    const prices = {}
    for (const coin of uniqueCoins) {
      const id = COINGECKO_IDS[coin]
      if (data[id]) {
        prices[coin] = {
          price:     data[id].usd || 0,
          change24h: data[id].usd_24h_change || 0,
          high24h:   data[id].usd_24h_high || data[id].usd || 0,
          low24h:    data[id].usd_24h_low  || data[id].usd || 0,
          volume:    data[id].usd_24h_vol  || 0,
        }
      }
    }
    serverPriceCache = prices
    serverCacheTime  = now
    return prices
  } catch (e) {
    console.error('fetchPrices error:', e)
    return serverPriceCache
  }
}

async function fetchKlines(coinId, days=14) {
  try {
    const res  = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
    )
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map(d => ({ open:d[1], high:d[2], low:d[3], close:d[4], volume:0 }))
  } catch { return [] }
}

async function fetchSentiment(behaviorSettings) {
  const signals = []
  try {
    // Fear & Greed Index
    if (behaviorSettings?.useFearGreed !== false) {
      const res  = await fetch('https://api.alternative.me/fng/?limit=1')
      const data = await res.json()
      if (data?.data?.[0]) {
        const { value, value_classification } = data.data[0]
        signals.push(`Fear & Greed Index: ${value}/100 (${value_classification})`)
      }
    }
    // Crypto news via CryptoPanic (public feed, no key needed)
    if (behaviorSettings?.useNewsSentiment) {
      const res  = await fetch('https://cryptopanic.com/api/v1/posts/?auth_token=public&kind=news&public=true')
      const data = await res.json()
      if (data?.results?.length) {
        const headlines = data.results.slice(0, 5).map(r => r.title).join(' | ')
        signals.push(`Recent crypto headlines: ${headlines}`)
      }
    }
  } catch (e) {
    console.error('Sentiment fetch error:', e)
  }
  return signals.length > 0 ? signals.join('\n') : null
}

function calcRSI(closes, period=14) {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1]
    if (diff > 0) gains += diff; else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2))
}

function calcMACD(closes) {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  const ema = (arr, period) => {
    const k = 2 / (period + 1)
    return arr.reduce((prev, curr, i) => i === 0 ? curr : prev * (1 - k) + curr * k, arr[0])
  }
  const ema12 = ema(closes.slice(-12), 12)
  const ema26 = ema(closes.slice(-26), 26)
  const macd  = ema12 - ema26
  return { macd: parseFloat(macd.toFixed(6)), signal: parseFloat((macd * 0.85).toFixed(6)), histogram: parseFloat((macd * 0.15).toFixed(6)) }
}

export async function POST(req) {
  try {
    const { agentId, userId, coins, prompt, riskSettings, behaviorSettings, portfolioValue, openPositions, cachedPrices } = await req.json()

    if (!agentId || !userId) return Response.json({ error: 'Missing agentId or userId' }, { status: 400 })

    // Use frontend cached prices or fetch fresh
    const prices = (cachedPrices && Object.keys(cachedPrices).length > 0)
      ? cachedPrices
      : await fetchPricesFromCoinGecko(coins)

    const analysis = {}
    for (const coin of coins) {
      if (!prices[coin]) continue
      const coinId = COINGECKO_IDS[coin]
      const klines = coinId ? await fetchKlines(coinId) : []
      const closes = klines.map(k => k.close)
      analysis[coin] = {
        ...prices[coin],
        rsi:  calcRSI(closes),
        macd: calcMACD(closes),
        recentCandles: klines.slice(-6).map(k => `O:${k.open.toFixed(2)} H:${k.high.toFixed(2)} L:${k.low.toFixed(2)} C:${k.close.toFixed(2)}`).join(' | '),
      }
    }

    // Fetch sentiment signals
    const sentimentContext = await fetchSentiment(behaviorSettings)

    const risk     = riskSettings || {}
    const behavior = behaviorSettings || {}

    const marketContext = Object.entries(analysis).map(([coin, data]) => `
${coin}/USDT:
  Price: $${data.price}
  24h Change: ${data.change24h?.toFixed(2)}%
  24h High: $${data.high24h} | Low: $${data.low24h}
  RSI(14): ${data.rsi}
  MACD: ${data.macd.macd} | Signal: ${data.macd.signal} | Hist: ${data.macd.histogram}
  Recent candles: ${data.recentCandles || 'unavailable'}
`).join('\n')

    const openPositionsContext = openPositions?.length > 0
      ? `\nOpen positions:\n${openPositions.map(p => `  ${p.coin} ${p.type}: entry $${p.entry_price}, size ${p.amount} units`).join('\n')}`
      : '\nNo open positions.'

    const systemPrompt = `You are an autonomous AI paper trading agent. You analyse real market data and make trading decisions using FAKE tokens. No real money is involved.

Strategy: ${prompt || 'Momentum and technical analysis based trading'}

Risk parameters:
- Max risk per trade: ${risk.maxRiskPerTrade || 2}%
- Max drawdown: ${risk.maxDrawdown || 10}%
- Max exposure: ${risk.maxExposure || 70}%
- Max single asset: ${risk.maxSingleAsset || 30}%
- Take-profit ratio: ${risk.takeProfitRatio || 3}x
- Aggressiveness: ${behavior.aggressiveness || 'balanced'}

Portfolio: $${portfolioValue} total (fake tokens)
${openPositionsContext}
${sentimentContext ? `\nSentiment signals:\n${sentimentContext}` : ''}

Respond ONLY with valid JSON:
{
  "action": "BUY" | "SELL" | "CLOSE" | "HOLD",
  "coin": "BTC" | "ETH" | "SOL" | "BNB" | "AVAX" | "MATIC" | "DOGE" | "SHIB" | "PEPE" | "WIF" | "BONK" | "FLOKI" | null,
  "amount_pct": 0-100,
  "reasoning": "plain English explanation",
  "confidence": 1-10,
  "indicators_used": ["RSI", "MACD", etc]
}`

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages:   [{ role: 'user', content: `Market data:\n${marketContext}\n\nAnalyse and decide.` }],
      system:     systemPrompt,
    })

    const text = response.content[0]?.text || '{}'
    let decision
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      decision = JSON.parse(clean)
    } catch {
      decision = { action: 'HOLD', coin: null, amount_pct: 0, reasoning: text, confidence: 5, indicators_used: [] }
    }

    if (decision.action === 'HOLD' || !decision.coin) {
      return Response.json({ action:'HOLD', reasoning:decision.reasoning, confidence:decision.confidence, marketData:analysis, tradeId:null })
    }

    const coinPrice = analysis[decision.coin]?.price
    if (!coinPrice) return Response.json({ action:'HOLD', reasoning:'Price unavailable', marketData:analysis })

    // Fetch current agent to get latest cash/invested
    const { data: currentAgent } = await supabase.from('agents').select('cash_balance, invested_value, portfolio_value').eq('id', agentId).single()
    const cashBalance   = parseFloat(currentAgent?.cash_balance ?? portfolioValue ?? 10000)
    const investedValue = parseFloat(currentAgent?.invested_value ?? 0)

    const allocationPct = Math.min(decision.amount_pct || risk.maxRiskPerTrade || 2, risk.maxSingleAsset || 30)
    const allocationUsd = (cashBalance * allocationPct) / 100
    const units         = allocationUsd / coinPrice

    let tradeRecord = null

    if (decision.action === 'CLOSE') {
      const { data: openTrade } = await supabase.from('trades').select('*').eq('agent_id', agentId).eq('coin', decision.coin).eq('status', 'open').single()

      if (openTrade) {
        const pnl = (coinPrice - openTrade.entry_price) * openTrade.amount * (openTrade.type === 'BUY' ? 1 : -1)
        const tradeValue = openTrade.entry_price * openTrade.amount

        await supabase.from('trades').update({
          exit_price: coinPrice, pnl, status: 'closed', closed_at: new Date().toISOString()
        }).eq('id', openTrade.id)

        // Return invested value back to cash + add PnL
        const newCash     = cashBalance + tradeValue + pnl
        const newInvested = Math.max(0, investedValue - tradeValue)
        const newTotal    = newCash + newInvested

        const { data: allTrades } = await supabase.from('trades').select('pnl').eq('agent_id', agentId).eq('status', 'closed')
        const wins    = (allTrades||[]).filter(t=>t.pnl>0).length
        const total   = (allTrades||[]).length
        const winRate = total > 0 ? Math.round((wins/total)*100) : 0
        const totalRet = ((newTotal - 10000) / 10000) * 100

        await supabase.from('agents').update({
          portfolio_value: newTotal,
          cash_balance:    newCash,
          invested_value:  newInvested,
          total_return:    parseFloat(totalRet.toFixed(2)),
          win_rate:        winRate,
          max_drawdown:    parseFloat(Math.abs(Math.min(0, totalRet)).toFixed(2)),
        }).eq('id', agentId)

        tradeRecord = { ...openTrade, exit_price: coinPrice, pnl, status: 'closed' }
      }
    } else if (decision.action === 'BUY' || decision.action === 'SELL') {
      if (allocationUsd > cashBalance) {
        return Response.json({ action:'HOLD', reasoning:'Insufficient cash balance for this trade', marketData:analysis })
      }

      const { data: newTrade } = await supabase.from('trades').insert({
        agent_id:    agentId,
        user_id:     userId,
        coin:        decision.coin,
        type:        decision.action,
        entry_price: coinPrice,
        amount:      parseFloat(units.toFixed(6)),
        status:      'open',
        reasoning:   decision.reasoning,
      }).select().single()

      // Deduct from cash, add to invested
      const newCash     = cashBalance - allocationUsd
      const newInvested = investedValue + allocationUsd
      const newTotal    = newCash + newInvested
      const totalRet    = ((newTotal - 10000) / 10000) * 100

      await supabase.from('agents').update({
        portfolio_value: newTotal,
        cash_balance:    newCash,
        invested_value:  newInvested,
        total_return:    parseFloat(totalRet.toFixed(2)),
      }).eq('id', agentId)

      tradeRecord = newTrade
    }

    return Response.json({
      action:     decision.action,
      coin:       decision.coin,
      price:      coinPrice,
      amount:     units,
      reasoning:  decision.reasoning,
      confidence: decision.confidence,
      indicators: decision.indicators_used,
      marketData: analysis,
      trade:      tradeRecord,
    })

  } catch (err) {
    console.error('Trade API error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}