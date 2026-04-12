import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COINGECKO_IDS = {
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', BNB:'binancecoin',
  AVAX:'avalanche-2', MATIC:'matic-network', DOGE:'dogecoin',
  PEPE:'pepe', WIF:'dogwifcoin', BONK:'bonk', FLOKI:'floki',
  AGENT:'solana', MEME:'solana',
}

let serverPriceCache = {}
let serverCacheTime  = 0

async function fetchPricesFromCoinGecko(coins) {
  const now = Date.now()
  if (Object.keys(serverPriceCache).length && now - serverCacheTime < 60000) return serverPriceCache
  try {
    const uniqueCoins = [...new Set(coins.filter(c => COINGECKO_IDS[c]))]
    const ids = [...new Set(uniqueCoins.map(c => COINGECKO_IDS[c]))].join(',')
    const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24hr=true&include_low_24hr=true`)
    const data = await res.json()
    const prices = {}
    for (const coin of uniqueCoins) {
      const id = COINGECKO_IDS[coin]
      if (data[id]) prices[coin] = { price:data[id].usd||0, change24h:data[id].usd_24h_change||0, high24h:data[id].usd_24h_high||data[id].usd||0, low24h:data[id].usd_24h_low||data[id].usd||0, volume:data[id].usd_24h_vol||0 }
    }
    serverPriceCache = prices; serverCacheTime = now
    return prices
  } catch (e) { console.error('fetchPrices error:', e); return serverPriceCache }
}

async function fetchKlines(coinId, days=14) {
  try {
    const res  = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`)
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map(d => ({ open:d[1], high:d[2], low:d[3], close:d[4], volume:0 }))
  } catch { return [] }
}

// ── Meme Mode: fetch DexScreener data for custom CA coins ────────────────────
async function fetchDexScreenerData(ca) {
  try {
    const res  = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`)
    const data = await res.json()
    const pair = data?.pairs?.[0]
    if (!pair) return null
    return {
      price:        parseFloat(pair.priceUsd || 0),
      priceChange1h: parseFloat(pair.priceChange?.h1 || 0),
      priceChange6h: parseFloat(pair.priceChange?.h6 || 0),
      change24h:    parseFloat(pair.priceChange?.h24 || 0),
      volume1h:     parseFloat(pair.volume?.h1 || 0),
      volume6h:     parseFloat(pair.volume?.h6 || 0),
      volume24h:    parseFloat(pair.volume?.h24 || 0),
      liquidity:    parseFloat(pair.liquidity?.usd || 0),
      marketCap:    parseFloat(pair.marketCap || 0),
      txns1h:       (pair.txns?.h1?.buys || 0) + (pair.txns?.h1?.sells || 0),
      buys1h:       pair.txns?.h1?.buys || 0,
      sells1h:      pair.txns?.h1?.sells || 0,
      dex:          pair.dexId,
      chain:        pair.chainId,
      name:         pair.baseToken?.name || '',
      pairAddress:  pair.pairAddress,
    }
  } catch { return null }
}

async function fetchForumSentiment(forumSettings, coins) {
  const signals = []

  try {
    const fngRes = await fetch('https://api.alternative.me/fng/?limit=1')
    const fngData = await fngRes.json()
    if (fngData?.data?.[0]) {
      const { value, value_classification } = fngData.data[0]
      signals.push(`Fear & Greed Index: ${value}/100 (${value_classification})`)
    }
  } catch {}

  try {
    if (forumSettings?.reddit) {
      const subs = ['CryptoMoonShots','memecoin','SatoshiStreetBets','CryptoCurrency']
      const posts = []
      for (const sub of subs) {
        const res  = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, { headers: { 'User-Agent':'AgentArena/1.0' } })
        const data = await res.json()
        posts.push(...(data?.data?.children?.map(p => p.data.title) || []))
      }
      if (posts.length) {
        const relevant = posts.filter(p => coins.some(c => p.toLowerCase().includes(c.toLowerCase())))
        const sample   = relevant.length > 0 ? relevant.slice(0,5) : posts.slice(0,5)
        signals.push(`Reddit trending:\n  ${sample.join('\n  ')}`)
      }
    }
  } catch {}

  try {
    if (forumSettings?.fourchan) {
      const res     = await fetch('https://a.4cdn.org/biz/catalog.json')
      const catalog = await res.json()
      const threads = catalog.flatMap(page => page.threads || [])
      const relevant = threads
        .filter(t => coins.some(c => (t.sub+' '+(t.com||'')).toLowerCase().includes(c.toLowerCase())))
        .slice(0,5).map(t => t.sub || (t.com||'').slice(0,100)).filter(Boolean)
      const sample = relevant.length > 0 ? relevant : threads.slice(0,3).map(t => t.sub||(t.com||'').slice(0,80)).filter(Boolean)
      if (sample.length) signals.push(`4chan /biz/:\n  ${sample.join('\n  ')}`)
    }
  } catch {}

  try {
    if (forumSettings?.cryptopanic) {
      const res  = await fetch('https://cryptopanic.com/api/v1/posts/?auth_token=public&kind=news&public=true')
      const data = await res.json()
      if (data?.results?.length) {
        const relevant = data.results.filter(r => coins.some(c => r.title.toLowerCase().includes(c.toLowerCase())))
        const sample   = relevant.length > 0 ? relevant.slice(0,5) : data.results.slice(0,5)
        signals.push(`CryptoPanic headlines:\n  ${sample.map(r => r.title).join('\n  ')}`)
      }
    }
  } catch {}

  return signals.length > 0 ? signals.join('\n\n') : null
}

function calcRSI(closes, period=14) {
  if (closes.length < period+1) return 50
  let gains=0, losses=0
  for (let i=closes.length-period; i<closes.length; i++) {
    const diff=closes[i]-closes[i-1]; if (diff>0) gains+=diff; else losses-=diff
  }
  const ag=gains/period, al=losses/period
  if (al===0) return 100
  return parseFloat((100-100/(1+ag/al)).toFixed(2))
}

function calcMACD(closes) {
  if (closes.length<26) return { macd:0, signal:0, histogram:0 }
  const ema=(arr,p)=>{ const k=2/(p+1); return arr.reduce((prev,curr,i)=>i===0?curr:prev*(1-k)+curr*k,arr[0]) }
  const macd=ema(closes.slice(-12),12)-ema(closes.slice(-26),26)
  return { macd:parseFloat(macd.toFixed(6)), signal:parseFloat((macd*0.85).toFixed(6)), histogram:parseFloat((macd*0.15).toFixed(6)) }
}

function buildMemeContext(sym, d) {
  const buyPressure = d.txns1h > 0 ? Math.round((d.buys1h / d.txns1h) * 100) : 0
  const volSpike    = d.volume6h > 0 ? (d.volume1h / (d.volume6h / 6)).toFixed(1) : '?'
  return `
${sym} (Meme Mode — DexScreener):
  Price: $${d.price < 0.01 ? d.price.toFixed(8) : d.price.toFixed(4)}
  1h change: ${d.priceChange1h >= 0 ? '+' : ''}${d.priceChange1h.toFixed(2)}%  |  6h: ${d.priceChange6h >= 0 ? '+' : ''}${d.priceChange6h.toFixed(2)}%  |  24h: ${d.change24h >= 0 ? '+' : ''}${d.change24h.toFixed(2)}%
  Volume 1h: $${d.volume1h.toLocaleString()}  |  Volume spike vs 6h avg: ${volSpike}x
  Buy pressure 1h: ${buyPressure}% buys (${d.buys1h} buys / ${d.sells1h} sells)
  Liquidity: $${d.liquidity.toLocaleString()}  |  Market cap: $${d.marketCap.toLocaleString()}
  DEX: ${d.dex}  |  Chain: ${d.chain}`
}

const MEME_MODE_PROMPT = `
MEME COIN MODE — different rules apply for custom CA tokens:

Entry signals (need 3+ of these):
- 1h price change > +5% (momentum building)
- Volume spike > 2x the 6h average (unusual activity)
- Buy pressure > 60% in last hour (more buys than sells)  
- Positive Reddit/4chan mentions (social momentum)
- Liquidity > $30,000 (can actually exit)
- Market cap < $10M (still early enough for upside)

Exit signals:
- 1h price change < -8% (momentum lost)
- Buy pressure drops below 40% (sellers taking over)
- Take-profit ratio hit

Never enter if:
- Liquidity < $10,000 (rug risk)
- No volume in last hour
- Market cap already > $50M (too late)
`

export async function POST(req) {
  try {
    const { agentId, userId, coins, prompt, riskSettings, behaviorSettings, portfolioValue, openPositions, cachedPrices, forumSettings, customCoinCas } = await req.json()

    if (!agentId || !userId) return Response.json({ error:'Missing agentId or userId' }, { status:400 })

    // Split coins into standard (CoinGecko) and custom CA (DexScreener)
    const standardCoins = coins.filter(c => COINGECKO_IDS[c])
    const customCoins   = coins.filter(c => !COINGECKO_IDS[c] && customCoinCas?.[c])

    // Fetch standard prices
    const prices = (cachedPrices && Object.keys(cachedPrices).length > 0)
      ? cachedPrices
      : await fetchPricesFromCoinGecko(standardCoins)

    const analysis = {}
    const memeAnalysis = {}

    // Standard coins — RSI + MACD
    for (const coin of standardCoins) {
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

    // Custom CA coins — DexScreener Meme Mode
    for (const coin of customCoins) {
      const ca   = customCoinCas[coin]
      const data = await fetchDexScreenerData(ca)
      if (data) {
        memeAnalysis[coin] = data
        // Also add to prices for position tracking
        prices[coin] = { price:data.price, change24h:data.change24h }
      }
    }

    // Forum sentiment
    const forumContext = await fetchForumSentiment(forumSettings || behaviorSettings, coins)

    const risk = riskSettings || {}, behavior = behaviorSettings || {}

    // Build market context
    const standardContext = Object.entries(analysis).map(([coin, data]) => `
${coin}/USDT:
  Price: $${data.price}  |  24h: ${data.change24h?.toFixed(2)}%
  RSI(14): ${data.rsi}  |  MACD Hist: ${data.macd.histogram}
  Recent candles: ${data.recentCandles || 'unavailable'}`).join('\n')

    const memeContext = Object.entries(memeAnalysis).map(([sym, d]) => buildMemeContext(sym, d)).join('\n')

    const openPositionsContext = openPositions?.length > 0
      ? `\nOpen positions:\n${openPositions.map(p => `  ${p.coin} ${p.type}: entry $${p.entry_price}, size ${p.amount} units`).join('\n')}`
      : '\nNo open positions.'

    const hasMemeCoins = customCoins.length > 0

    const systemPrompt = `You are an autonomous AI paper trading agent making decisions with FAKE tokens. No real money involved.

Strategy: ${prompt || 'Momentum and technical analysis based trading'}
${hasMemeCoins ? MEME_MODE_PROMPT : ''}

Risk parameters:
- Max risk per trade: ${risk.maxRiskPerTrade || 2}%
- Max single asset: ${risk.maxSingleAsset || 30}%
- Take-profit ratio: ${risk.takeProfitRatio || 3}x
- Aggressiveness: ${behavior.aggressiveness || 'balanced'}

Portfolio: $${portfolioValue} total (fake tokens)
${openPositionsContext}
${forumContext ? `\nSocial & sentiment signals:\n${forumContext}` : ''}

Respond ONLY with valid JSON:
{
  "action": "BUY" | "SELL" | "CLOSE" | "HOLD",
  "coin": ${[...Object.keys(analysis), ...Object.keys(memeAnalysis)].map(c => `"${c}"`).join(' | ')} | null,
  "amount_pct": 0-100,
  "reasoning": "plain English — mention specific signals used",
  "confidence": 1-10,
  "indicators_used": ["RSI", "Volume spike", "Reddit", etc]
}`

    const marketContext = [
      standardContext ? `Standard coins:\n${standardContext}` : '',
      memeContext     ? `\nMeme coins (DexScreener):\n${memeContext}` : '',
    ].filter(Boolean).join('\n')

    const response = await anthropic.messages.create({
      model:'claude-sonnet-4-20250514', max_tokens:600,
      messages:[{ role:'user', content:`Market data:\n${marketContext}\n\nAnalyse and decide.` }],
      system:systemPrompt,
    })

    const text = response.content[0]?.text || '{}'
let decision

// ── RANDOM MODE (testing) ─────────────────────────────────
const allCoins = [...coins]
const actions  = ['BUY', 'HOLD', 'HOLD', 'CLOSE']
const randAction = actions[Math.floor(Math.random() * actions.length)]
// Only pick coins that have prices available
const availableCoins = allCoins.filter(c => analysis[c] || memeAnalysis?.[c])
if (!availableCoins.length) return Response.json({ action:'HOLD', reasoning:'No priced coins available', marketData:analysis, tradeId:null })
const randCoin = availableCoins[Math.floor(Math.random() * availableCoins.length)]
decision = {
  action:         randAction,
  coin:           randAction === 'HOLD' ? null : randCoin,
  amount_pct:     Math.floor(Math.random() * 20) + 5,
  reasoning:      `Random test trade — ${randAction} ${randCoin || ''} for UI testing purposes.`,
  confidence:     Math.floor(Math.random() * 10) + 1,
  indicators_used: ['RANDOM'],
}
// ─────────────────────────────────────────────────────────

    if (decision.action === 'HOLD' || !decision.coin) {
      return Response.json({ action:'HOLD', reasoning:decision.reasoning, confidence:decision.confidence, marketData:{...analysis,...memeAnalysis}, tradeId:null })
    }

    // Get price for the decided coin
    const coinPrice = analysis[decision.coin]?.price || memeAnalysis[decision.coin]?.price
    if (!coinPrice) return Response.json({ action:'HOLD', reasoning:'Price unavailable', marketData:{...analysis,...memeAnalysis} })

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
        await supabase.from('trades').update({ exit_price:coinPrice, pnl, status:'closed', closed_at:new Date().toISOString() }).eq('id', openTrade.id)
        const newCash=cashBalance+tradeValue+pnl, newInvested=Math.max(0,investedValue-tradeValue), newTotal=newCash+newInvested
        const { data: allTrades } = await supabase.from('trades').select('pnl').eq('agent_id', agentId).eq('status', 'closed')
        const wins=(allTrades||[]).filter(t=>t.pnl>0).length, total=(allTrades||[]).length
        const totalRet=((newTotal-10000)/10000)*100
        await supabase.from('agents').update({ portfolio_value:newTotal, cash_balance:newCash, invested_value:newInvested, total_return:parseFloat(totalRet.toFixed(2)), win_rate:total>0?Math.round((wins/total)*100):0, max_drawdown:parseFloat(Math.abs(Math.min(0,totalRet)).toFixed(2)) }).eq('id', agentId)
        tradeRecord = { ...openTrade, exit_price:coinPrice, pnl, status:'closed' }
      }
    } else if (decision.action === 'BUY' || decision.action === 'SELL') {
      if (allocationUsd > cashBalance) return Response.json({ action:'HOLD', reasoning:'Insufficient cash balance', marketData:{...analysis,...memeAnalysis} })
      const { data: newTrade } = await supabase.from('trades').insert({ agent_id:agentId, user_id:userId, coin:decision.coin, type:decision.action, entry_price:coinPrice, amount:parseFloat(units.toFixed(6)), status:'open', reasoning:decision.reasoning }).select().single()
      const newCash=cashBalance-allocationUsd, newInvested=investedValue+allocationUsd, newTotal=newCash+newInvested
      await supabase.from('agents').update({ portfolio_value:newTotal, cash_balance:newCash, invested_value:newInvested, total_return:parseFloat(((newTotal-10000)/10000*100).toFixed(2)) }).eq('id', agentId)
      tradeRecord = newTrade
    }

    return Response.json({ action:decision.action, coin:decision.coin, price:coinPrice, amount:units, reasoning:decision.reasoning, confidence:decision.confidence, indicators:decision.indicators_used, marketData:{...analysis,...memeAnalysis}, trade:tradeRecord })

  } catch (err) {
    console.error('Trade API error:', err)
    return Response.json({ error:err.message }, { status:500 })
  }
}