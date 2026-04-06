import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COIN_SYMBOLS = {
  BTC:   'BTCUSDT',
  ETH:   'ETHUSDT',
  SOL:   'SOLUSDT',
  BNB:   'BNBUSDT',
  AGENT: 'SOLUSDT',
  MEME:  'SOLUSDT',
}

async function fetchPrices(coins) {
  const prices = {}
  const uniqueCoins = [...new Set(coins.filter(c => COIN_SYMBOLS[c]))]
  await Promise.all(uniqueCoins.map(async coin => {
    try {
      const symbol = COIN_SYMBOLS[coin]
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
      const d   = await res.json()
      if (d.lastPrice) {
        prices[coin] = {
          price:     parseFloat(d.lastPrice),
          change24h: parseFloat(d.priceChangePercent),
          high24h:   parseFloat(d.highPrice),
          low24h:    parseFloat(d.lowPrice),
          volume:    parseFloat(d.volume),
        }
      }
    } catch (e) {
      console.error(`fetchPrices error for ${coin}:`, e)
    }
  }))
  return prices
}

async function fetchKlines(symbol, interval='1h', limit=24) {
  try {
    const res  = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    const data = await res.json()
    return data.map(d => ({
      open:   parseFloat(d[1]),
      high:   parseFloat(d[2]),
      low:    parseFloat(d[3]),
      close:  parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }))
  } catch { return [] }
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
  const rs = avgGain / avgLoss
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2))
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
    const { agentId, userId, coins, prompt, riskSettings, behaviorSettings, portfolioValue, openPositions } = await req.json()

    if (!agentId || !userId) return Response.json({ error: 'Missing agentId or userId' }, { status: 400 })

    const prices  = await fetchPrices(coins)
    const analysis = {}

    for (const coin of coins) {
      const symbol = COIN_SYMBOLS[coin]
      if (!symbol || !prices[coin]) continue
      const klines = await fetchKlines(symbol)
      const closes = klines.map(k => k.close)
      analysis[coin] = {
        ...prices[coin],
        rsi:  calcRSI(closes),
        macd: calcMACD(closes),
        recentCandles: klines.slice(-6).map(k => `O:${k.open.toFixed(2)} H:${k.high.toFixed(2)} L:${k.low.toFixed(2)} C:${k.close.toFixed(2)}`).join(' | '),
      }
    }

    const risk = riskSettings || {}
    const behavior = behaviorSettings || {}

    const marketContext = Object.entries(analysis).map(([coin, data]) => `
${coin}/USDT:
  Price: $${data.price}
  24h Change: ${data.change24h}%
  24h High: $${data.high24h} | Low: $${data.low24h}
  RSI(14): ${data.rsi}
  MACD: ${data.macd.macd} | Signal: ${data.macd.signal} | Hist: ${data.macd.histogram}
  Recent candles (1h): ${data.recentCandles}
`).join('\n')

    const openPositionsContext = openPositions?.length > 0
      ? `\nCurrent open positions:\n${openPositions.map(p => `  ${p.coin} ${p.type}: entry $${p.entry_price}, size ${p.amount} units, unrealised PnL: $${((analysis[p.coin]?.price || p.entry_price) - p.entry_price) * p.amount * (p.type==='BUY'?1:-1)}`).join('\n')}`
      : '\nNo open positions currently.'

    const systemPrompt = `You are an autonomous AI paper trading agent. You analyse real market data and make trading decisions using FAKE tokens for training purposes. No real money is involved.

Your strategy: ${prompt || 'Momentum and technical analysis based trading'}

Risk parameters:
- Max risk per trade: ${risk.maxRiskPerTrade || 2}% of portfolio
- Max drawdown: ${risk.maxDrawdown || 10}%
- Max portfolio exposure: ${risk.maxExposure || 70}%
- Max single asset: ${risk.maxSingleAsset || 30}%
- Take-profit ratio: ${risk.takeProfitRatio || 3}x
- Trading hours: ${risk.tradingHours || 'always'}
- Aggressiveness: ${behavior.aggressiveness || 'balanced'}
- Learn from losses: ${behavior.learnFromLosses ? 'yes' : 'no'}
- Auto-reduce on drawdown: ${behavior.autoReduceDrawdown ? 'yes' : 'no'}

Current portfolio value: $${portfolioValue} (fake tokens)
${openPositionsContext}

You MUST respond ONLY with a valid JSON object in this exact format:
{
  "action": "BUY" | "SELL" | "CLOSE" | "HOLD",
  "coin": "BTC" | "ETH" | "SOL" | "BNB" | "AGENT" | "MEME" | null,
  "amount_pct": 0-100,
  "reasoning": "plain English explanation of your decision",
  "confidence": 1-10,
  "indicators_used": ["RSI", "MACD", etc]
}

action must be one of: BUY (open long), SELL (open short), CLOSE (close existing position), HOLD (do nothing)
amount_pct is the percentage of portfolio to allocate (0 if HOLD)
Only trade if you have genuine conviction. Explain your reasoning clearly.`

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages:   [{ role: 'user', content: `Current market data:\n${marketContext}\n\nAnalyse and decide.` }],
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
      return Response.json({
        action:     'HOLD',
        reasoning:  decision.reasoning,
        confidence: decision.confidence,
        marketData: analysis,
        tradeId:    null,
      })
    }

    const coinPrice = analysis[decision.coin]?.price
    if (!coinPrice) return Response.json({ action:'HOLD', reasoning:'Price unavailable', marketData: analysis })

    const maxRiskPct    = risk.maxRiskPerTrade || 2
    const allocationPct = Math.min(decision.amount_pct || maxRiskPct, risk.maxSingleAsset || 30)
    const allocationUsd = (portfolioValue * allocationPct) / 100
    const units         = allocationUsd / coinPrice

    let tradeRecord = null

    if (decision.action === 'CLOSE') {
      const { data: openTrade } = await supabase
        .from('trades')
        .select('*')
        .eq('agent_id', agentId)
        .eq('coin', decision.coin)
        .eq('status', 'open')
        .single()

      if (openTrade) {
        const pnl = (coinPrice - openTrade.entry_price) * openTrade.amount * (openTrade.type === 'BUY' ? 1 : -1)
        await supabase.from('trades').update({
          exit_price: coinPrice,
          pnl,
          status:    'closed',
          closed_at: new Date().toISOString(),
        }).eq('id', openTrade.id)

        const newPortfolioValue = portfolioValue + pnl
        const { data: allTrades } = await supabase.from('trades').select('pnl').eq('agent_id', agentId).eq('status', 'closed')
        const wins    = (allTrades || []).filter(t => t.pnl > 0).length
        const total   = (allTrades || []).length
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
        const totalRet = ((newPortfolioValue - 10000) / 10000) * 100
        const maxDD    = Math.min(0, totalRet)

        await supabase.from('agents').update({
          portfolio_value: newPortfolioValue,
          total_return:    parseFloat(totalRet.toFixed(2)),
          win_rate:        winRate,
          max_drawdown:    parseFloat(Math.abs(maxDD).toFixed(2)),
        }).eq('id', agentId)

        tradeRecord = { ...openTrade, exit_price: coinPrice, pnl, status: 'closed' }
      }
    } else {
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