import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  DOGE: 'dogecoin', ADA: 'cardano', XRP: 'ripple', AVAX: 'avalanche-2',
  MATIC: 'matic-network', LINK: 'chainlink', DOT: 'polkadot',
  SHIB: 'shiba-inu', PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk',
  FLOKI: 'floki',
};

// Binance symbol map — used to parse cachedPrices from client
const BINANCE_SYMBOLS = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  DOGE: 'DOGEUSDT', AVAX: 'AVAXUSDT', MATIC: 'MATICUSDT',
  PEPE: 'PEPEUSDT', WIF: 'WIFUSDT', BONK: 'BONKUSDT', FLOKI: 'FLOKIUSDT',
};

const CRYPTO_KEYWORDS = [
  'bitcoin','btc','ethereum','eth','solana','sol','crypto','doge','xrp',
  'coinbase','binance','altcoin','memecoin','defi','token','blockchain',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeNum(val, fallback = 0) {
  const n = Number(val);
  return (isNaN(n) || !isFinite(n)) ? fallback : n;
}

function calcEMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const rs = gains / (losses || 0.001);
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes) {
  if (closes.length < 26) return { histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  return { macd, signal: macd * 0.9, histogram: macd * 0.1 };
}

// Get price from cachedPrices (passed from client Binance WebSocket)
function getPriceFromCache(symbol, cachedPrices) {
  if (!cachedPrices || typeof cachedPrices !== 'object') return 0;
  // Try direct symbol
  if (cachedPrices[symbol]) return safeNum(cachedPrices[symbol]);
  // Try Binance pair format
  const binancePair = BINANCE_SYMBOLS[symbol];
  if (binancePair && cachedPrices[binancePair]) return safeNum(cachedPrices[binancePair]);
  return 0;
}

async function fetchOHLC(coinId) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch { return null; }
}

async function fetchSpotPrice(coinId) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return safeNum(data?.[coinId]?.usd);
  } catch { return 0; }
}

async function fetchDexScreener(ca) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pair = data?.pairs?.[0];
    if (!pair) return null;
    return {
      price:    safeNum(pair.priceUsd),
      change1h: safeNum(pair.priceChange?.h1),
      change6h: safeNum(pair.priceChange?.h6),
      change24h:safeNum(pair.priceChange?.h24),
      volume24h:safeNum(pair.volume?.h24),
      liquidity:safeNum(pair.liquidity?.usd),
      symbol:   pair.baseToken?.symbol?.toUpperCase() || ca.slice(0, 6),
    };
  } catch { return null; }
}

async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1',
      { signal: AbortSignal.timeout(4000) }
    );
    const data = await res.json();
    return data?.data?.[0] || { value: 50, value_classification: 'Neutral' };
  } catch { return { value: 50, value_classification: 'Neutral' }; }
}

async function fetchPolymarketMarkets() {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?limit=100&active=true',
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const all = await res.json();
    return (Array.isArray(all) ? all : [])
      .filter(m => CRYPTO_KEYWORDS.some(kw => (m.question || '').toLowerCase().includes(kw)))
      .slice(0, 5)
      .map(m => ({
        id: m.id || m.conditionId,
        question: m.question,
        outcomes: m.outcomes || ['Yes', 'No'],
        outcomePrices: m.outcomePrices || ['0.5', '0.5'],
        endDate: m.endDate,
        volume: m.volume || 0,
      }));
  } catch { return []; }
}

// ── Main Route ───────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      agentId,
      userId,
      coins = [],
      riskSettings = {},
      behaviorSettings = {},
      cachedPrices = {},
      customCoinCas = {},
      openPositions: clientOpenPositions = [],
      portfolioValue: clientPortfolioValue = 10000,
    } = body;

    // ── Load agent balances ─────────────────────────────────────────────
    const { data: agentRow } = await supabase
      .from('agents')
      .select('cash_balance, invested_value, polymarket_balance, portfolio_value')
      .eq('id', agentId)
      .maybeSingle();

    let cashBalance   = safeNum(agentRow?.cash_balance,   clientPortfolioValue || 10000);
    let investedValue = safeNum(agentRow?.invested_value, 0);
    let polyBalance   = safeNum(agentRow?.polymarket_balance, 0);

    // ── Load open trades ────────────────────────────────────────────────
    const { data: openTradesDB } = await supabase
      .from('trades')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'open');

    const openPositions = openTradesDB?.length ? openTradesDB : (clientOpenPositions || []);

    const maxPositions    = safeNum(riskSettings.maxPositions, 3);
    const positionSizePct = safeNum(riskSettings.positionSize, 10);
    const stopLossPct     = safeNum(riskSettings.stopLoss, 8);
    const takeProfitPct   = safeNum(riskSettings.takeProfit, 20);

    const fearGreed = await fetchFearGreed();
    const tradeResults = [];

    // ── Standard Coins ──────────────────────────────────────────────────
    const coinList = Array.isArray(coins) ? coins : [];

    for (const coin of coinList) {
      const symbol = coin.toUpperCase();
      const coinId = COINGECKO_IDS[symbol];
      if (!coinId) continue;

      // 1. Try client cache first (Binance WebSocket — most accurate)
      let price = getPriceFromCache(symbol, cachedPrices);

      // 2. Try CoinGecko OHLC for RSI/MACD
      let rsi = 50;
      let macdData = { histogram: 0 };

      const ohlc = await fetchOHLC(coinId);
      if (ohlc && ohlc.length > 0) {
        const closes = ohlc.map(c => safeNum(c[4])).filter(p => p > 0);
        if (closes.length > 0) {
          rsi = calcRSI(closes);
          macdData = calcMACD(closes);
          // Only use OHLC price if we don't have a cached price
          if (!price || price <= 0) {
            price = closes[closes.length - 1];
          }
        }
      }

      // 3. Fall back to CoinGecko spot price
      if (!price || price <= 0) {
        price = await fetchSpotPrice(coinId);
      }

      // Skip if still no price
      if (!price || price <= 0) {
        console.log(`No price for ${symbol}, skipping`);
        continue;
      }

      const openPosition = openPositions.find(t => t.coin === symbol);
      const rand = Math.random();
      let action = 'HOLD';

      if (openPosition) {
        const entryPrice = safeNum(openPosition.entry_price, price);
        const changePct  = entryPrice > 0 ? ((price - entryPrice) / entryPrice) * 100 : 0;

        if (changePct >= takeProfitPct) {
          action = 'CLOSE'; // Take profit
        } else if (changePct <= -stopLossPct) {
          action = 'CLOSE'; // Stop loss
        } else if (rsi > 72) {
          action = 'CLOSE'; // Overbought
        } else if (rand < 0.25) {
          action = 'CLOSE'; // Random exit
        }
      } else {
        // Only buy if we have room and cash
        if (openPositions.filter(p => p.status === 'open').length < maxPositions) {
          if (rand < 0.65) action = 'BUY';
        }
      }

      const tradeSizeUSD = (cashBalance * positionSizePct) / 100;
      const units        = tradeSizeUSD / price; // actual units of the coin

      if (action === 'BUY' && cashBalance >= tradeSizeUSD && tradeSizeUSD >= 1 && units > 0) {
        cashBalance   -= tradeSizeUSD;
        investedValue += tradeSizeUSD;

        await supabase.from('trades').insert({
          agent_id:    agentId,
          user_id:     userId,
          coin:        symbol,
          type:        'buy',
          entry_price: parseFloat(price.toFixed(8)),
          amount:      parseFloat(units.toFixed(8)),  // units of coin
          status:      'open',
          reasoning:   `BUY ${symbol} @ $${price.toFixed(4)} — RSI: ${rsi.toFixed(1)}, MACD: ${macdData.histogram.toFixed(4)}, F&G: ${fearGreed.value}`,
        });

        tradeResults.push({ action: 'BUY', coin: symbol, price, amount: units, reasoning: `RSI ${rsi.toFixed(1)} · F&G ${fearGreed.value}` });
      }

      if (action === 'CLOSE' && openPosition) {
        const entryPrice = safeNum(openPosition.entry_price, price);
        const posUnits   = safeNum(openPosition.amount, 0);
        const pnl        = (price - entryPrice) * posUnits;
        const returned   = (entryPrice * posUnits) + pnl; // original cost + pnl

        cashBalance   += returned;
        investedValue  = Math.max(0, investedValue - (entryPrice * posUnits));

        await supabase.from('trades').update({
          status:     'closed',
          exit_price: parseFloat(price.toFixed(8)),
          pnl:        parseFloat(pnl.toFixed(4)),
          closed_at:  new Date().toISOString(),
          reasoning:  `CLOSE ${symbol} @ $${price.toFixed(4)} — Entry $${entryPrice.toFixed(4)}, P&L: $${pnl.toFixed(2)}`,
        }).eq('id', openPosition.id);

        tradeResults.push({ action: 'CLOSE', coin: symbol, price, pnl, trade: { pnl } });
      }
    }

    // ── Custom CA Meme Coins ────────────────────────────────────────────
    const caEntries = typeof customCoinCas === 'object' && !Array.isArray(customCoinCas)
      ? Object.entries(customCoinCas)
      : [];

    for (const [sym, ca] of caEntries) {
      if (!ca) continue;
      const dex = await fetchDexScreener(ca);
      if (!dex || !dex.price || dex.price <= 0) continue;

      const { symbol, price, change1h, change6h, change24h, volume24h, liquidity } = dex;
      const openPosition = openPositions.find(t => t.coin === symbol);

      let bullishSignals = 0;
      if (change1h  >  3) bullishSignals++;
      if (change6h  >  8) bullishSignals++;
      if (change24h > 15) bullishSignals++;
      if (volume24h > 50000) bullishSignals++;
      if (liquidity > 20000) bullishSignals++;

      const rand = Math.random();
      let action = 'HOLD';

      if (openPosition) {
        const entryPrice = safeNum(openPosition.entry_price, price);
        const changePct  = entryPrice > 0 ? ((price - entryPrice) / entryPrice) * 100 : 0;
        if (changePct >= takeProfitPct || changePct <= -stopLossPct) action = 'CLOSE';
        else if (rand < 0.2) action = 'CLOSE';
      } else {
        if (bullishSignals >= 3 && openPositions.length < maxPositions && rand < 0.5) action = 'BUY';
      }

      const tradeSizeUSD = (cashBalance * positionSizePct) / 100;
      const units        = tradeSizeUSD / price;

      if (action === 'BUY' && cashBalance >= tradeSizeUSD && units > 0) {
        cashBalance   -= tradeSizeUSD;
        investedValue += tradeSizeUSD;

        await supabase.from('trades').insert({
          agent_id:    agentId,
          user_id:     userId,
          coin:        symbol,
          type:        'buy',
          entry_price: parseFloat(price.toFixed(8)),
          amount:      parseFloat(units.toFixed(8)),
          status:      'open',
          reasoning:   `MEME BUY ${symbol} @ $${price.toFixed(8)} — ${bullishSignals}/5 signals. 1h:${change1h}% 24h:${change24h}%`,
        });

        tradeResults.push({ action: 'BUY', coin: symbol, price, amount: units, meme: true });
      }

      if (action === 'CLOSE' && openPosition) {
        const entryPrice = safeNum(openPosition.entry_price, price);
        const posUnits   = safeNum(openPosition.amount, 0);
        const pnl        = (price - entryPrice) * posUnits;
        cashBalance   += (entryPrice * posUnits) + pnl;
        investedValue  = Math.max(0, investedValue - (entryPrice * posUnits));

        await supabase.from('trades').update({
          status:     'closed',
          exit_price: parseFloat(price.toFixed(8)),
          pnl:        parseFloat(pnl.toFixed(4)),
          closed_at:  new Date().toISOString(),
        }).eq('id', openPosition.id);

        tradeResults.push({ action: 'CLOSE', coin: symbol, price, pnl });
      }
    }

    // ── Polymarket Betting ──────────────────────────────────────────────
    let polyResult = null;
    try {
      const markets = await fetchPolymarketMarkets();
      if (markets.length > 0) {
        const { data: openBets } = await supabase
          .from('polymarket_bets')
          .select('id, stake, created_at, odds, potential_payout, outcome')
          .eq('agent_id', agentId)
          .eq('status', 'open');

        // Auto-resolve old bets (> 7 days)
        for (const bet of openBets || []) {
          const ageDays = (Date.now() - new Date(bet.created_at).getTime()) / 86400000;
          if (ageDays > 7) {
            const won = Math.random() < safeNum(bet.odds, 0.5);
            const pnl = won ? bet.potential_payout - bet.stake : -bet.stake;
            await supabase.from('polymarket_bets').update({
              status: 'resolved', result: won ? 'win' : 'loss',
              pnl: parseFloat(pnl.toFixed(2)), resolved_at: new Date().toISOString(),
            }).eq('id', bet.id);
            polyBalance = Math.max(0, polyBalance - bet.stake);
            if (won) cashBalance += bet.potential_payout;
          }
        }

        const activeBets = (openBets || []).filter(b => {
          return (Date.now() - new Date(b.created_at).getTime()) / 86400000 <= 7;
        });

        if (activeBets.length < 3 && Math.random() < 0.12 && cashBalance > 200) {
          const market   = markets[Math.floor(Math.random() * markets.length)];
          const outcomes = market.outcomes || ['Yes', 'No'];
          const prices_  = market.outcomePrices || ['0.5', '0.5'];
          const idx      = Math.random() < 0.5 ? 0 : 1;
          const outcome  = outcomes[idx];
          const odds     = safeNum(prices_[idx], 0.5);
          const maxStake = Math.min(cashBalance * 0.04, 300);
          const stake    = parseFloat(Math.max(50, maxStake).toFixed(2));
          const payout   = parseFloat((stake / Math.max(odds, 0.01)).toFixed(2));

          cashBalance -= stake;
          polyBalance += stake;

          const { error: betErr } = await supabase.from('polymarket_bets').insert({
            agent_id: agentId, user_id: userId,
            market_id: market.id, question: market.question,
            outcome, odds, stake, potential_payout: payout, status: 'open',
            reasoning: `${(odds*100).toFixed(0)}% implied prob. Payout: $${payout.toFixed(0)}`,
          });

          if (!betErr) {
            polyResult = { action: 'BET', market: market.question, outcome, stake, odds, potential_payout: payout };
          } else {
            cashBalance += stake;
            polyBalance -= stake;
          }
        }
      }
    } catch (polyErr) {
      console.error('Polymarket error:', polyErr.message);
    }

    // ── Update agent stats ──────────────────────────────────────────────
    const { data: allClosed } = await supabase
      .from('trades').select('pnl').eq('agent_id', agentId).eq('status', 'closed');

    const closedCount = allClosed?.length || 0;
    const wins        = allClosed?.filter(t => safeNum(t.pnl) > 0).length || 0;
    const winRate     = closedCount > 0 ? parseFloat(((wins / closedCount) * 100).toFixed(1)) : 0;

    const portfolioValue = cashBalance + investedValue + polyBalance;
    const totalReturn    = parseFloat((((portfolioValue - 10000) / 10000) * 100).toFixed(2));

    await supabase.from('agents').update({
      cash_balance:       parseFloat(Math.max(0, cashBalance).toFixed(4)),
      invested_value:     parseFloat(Math.max(0, investedValue).toFixed(4)),
      polymarket_balance: parseFloat(Math.max(0, polyBalance).toFixed(4)),
      portfolio_value:    parseFloat(portfolioValue.toFixed(4)),
      win_rate:           winRate,
      total_return:       totalReturn,
      status:             'active',
    }).eq('id', agentId);

    // Return in format AgentDetail expects
    const firstTrade = tradeResults[0];
    return NextResponse.json({
      action:    firstTrade?.action || 'HOLD',
      coin:      firstTrade?.coin   || null,
      price:     firstTrade?.price  || null,
      amount:    firstTrade?.amount || null,
      confidence: 7,
      reasoning: tradeResults.length
        ? tradeResults.map(t => `${t.action} ${t.coin}`).join(', ')
        : 'No trades this scan — holding.',
      trade:     firstTrade?.pnl != null ? { pnl: firstTrade.pnl } : null,
      success:   true,
      trades:    tradeResults,
      polymarket: polyResult,
      fearGreed,
      portfolio: {
        cash:       cashBalance,
        invested:   investedValue,
        polymarket: polyBalance,
        total:      portfolioValue,
      },
    });

  } catch (err) {
    console.error('Trade route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}