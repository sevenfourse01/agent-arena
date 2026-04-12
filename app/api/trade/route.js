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
  SHIB: 'shiba-inu', UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin',
  PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk',
};

const CRYPTO_KEYWORDS = [
  'bitcoin','btc','ethereum','eth','solana','sol','crypto','doge','xrp',
  'coinbase','binance','altcoin','memecoin','defi','token','blockchain',
];

function calcEMA(prices, period) {
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
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  return { macd, signal: macd * 0.9, histogram: macd * 0.1 };
}

async function fetchOHLC(coinId) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchDexScreener(ca) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`);
    if (!res.ok) return null;
    const data = await res.json();
    const pair = data?.pairs?.[0];
    if (!pair) return null;
    return {
      price: parseFloat(pair.priceUsd || 0),
      change1h: pair.priceChange?.h1 || 0,
      change6h: pair.priceChange?.h6 || 0,
      change24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      marketCap: pair.marketCap || 0,
      symbol: pair.baseToken?.symbol || ca.slice(0, 6),
    };
  } catch { return null; }
}

async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    const data = await res.json();
    return data?.data?.[0] || { value: 50, value_classification: 'Neutral' };
  } catch { return { value: 50, value_classification: 'Neutral' }; }
}

async function fetchPolymarketMarkets() {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?limit=100&active=true',
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return [];
    const all = await res.json();
    return (Array.isArray(all) ? all : [])
      .filter((m) => CRYPTO_KEYWORDS.some((kw) => (m.question || '').toLowerCase().includes(kw)))
      .slice(0, 5)
      .map((m) => ({
        id: m.id || m.conditionId,
        question: m.question,
        outcomes: m.outcomes || ['Yes', 'No'],
        outcomePrices: m.outcomePrices || ['0.5', '0.5'],
        endDate: m.endDate,
        volume: m.volume || 0,
      }));
  } catch { return []; }
}

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

    // ── Get current balances from DB ──────────────────────────────────
    // Use maybeSingle so RLS non-matches don't throw
    const { data: agentRow } = await supabase
      .from('agents')
      .select('cash_balance, invested_value, polymarket_balance, portfolio_value, win_rate, total_return')
      .eq('id', agentId)
      .maybeSingle();

    let cashBalance  = agentRow?.cash_balance  ?? clientPortfolioValue ?? 10000;
    let investedValue = agentRow?.invested_value ?? 0;
    let polyBalance  = agentRow?.polymarket_balance ?? 0;

    // ── Get open trades from DB ───────────────────────────────────────
    const { data: openTradesDB } = await supabase
      .from('trades')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'open');

    const openPositions = openTradesDB || clientOpenPositions || [];

    const maxPositions   = riskSettings.maxPositions   || 2;
    const positionSizePct = riskSettings.positionSize  || 10;
    const stopLossPct    = riskSettings.stopLoss       || 5;
    const takeProfitPct  = riskSettings.takeProfit     || 15;

    const fearGreed = await fetchFearGreed();
    const tradeResults = [];
    const marketSentiment = parseInt(fearGreed.value);
    const blockNewBuys = false; // random mode — ignore sentiment

    // ── Standard Coins ────────────────────────────────────────────────
    const coinList = Array.isArray(coins) ? coins : [];
    for (const coin of coinList) {
      const symbol = coin.toUpperCase();
      const coinId = COINGECKO_IDS[symbol];
      if (!coinId) continue;

      let price = cachedPrices[symbol] || cachedPrices[coinId] || null;
      let rsi = 50;
      let macdData = { histogram: 0 };

      const ohlc = await fetchOHLC(coinId);
      if (ohlc && Array.isArray(ohlc) && ohlc.length > 0) {
        const closes = ohlc.map((c) => c[4]);
        rsi = calcRSI(closes);
        macdData = calcMACD(closes);
        if (!price) price = closes[closes.length - 1];
      }
      if (!price) continue;

      const openPosition = openPositions.find((t) => t.coin === symbol);
      const rand = Math.random();
      let action = 'HOLD';

      if (openPosition) {
        const changePct = ((price - openPosition.entry_price) / openPosition.entry_price) * 100;
        if (changePct >= takeProfitPct || changePct <= -stopLossPct || rsi > 75) action = 'CLOSE';
        else if (rand < 0.2) action = 'CLOSE';
      } else {
        if (!blockNewBuys && openPositions.length < maxPositions && rand < 0.25) action = 'BUY';
      }

      const tradeSize = (cashBalance * positionSizePct) / 100;

      if (action === 'BUY' && cashBalance >= tradeSize && tradeSize > 0) {
        cashBalance -= tradeSize;
        investedValue += tradeSize;
        await supabase.from('trades').insert({
          agent_id: agentId, user_id: userId, coin: symbol, type: 'buy',
          entry_price: price, amount: parseFloat(tradeSize.toFixed(2)), status: 'open',
          reasoning: `BUY — RSI: ${rsi.toFixed(1)}, MACD: ${macdData.histogram.toFixed(4)}, F&G: ${fearGreed.value}`,
        });
        tradeResults.push({ action: 'BUY', coin: symbol, price, amount: tradeSize });
      }

      if (action === 'CLOSE' && openPosition) {
        const pnlPct = (price - openPosition.entry_price) / openPosition.entry_price;
        const pnl = openPosition.amount * pnlPct;
        cashBalance += openPosition.amount + pnl;
        investedValue = Math.max(0, investedValue - openPosition.amount);
        await supabase.from('trades').update({
          status: 'closed', exit_price: price,
          pnl: parseFloat(pnl.toFixed(2)),
          closed_at: new Date().toISOString(),
          reasoning: `CLOSE — Exit $${price.toFixed(4)}, P&L: $${pnl.toFixed(2)}`,
        }).eq('id', openPosition.id);
        tradeResults.push({ action: 'CLOSE', coin: symbol, price, pnl });
      }
    }

    // ── Custom CA Meme Coins ──────────────────────────────────────────
    const caEntries = typeof customCoinCas === 'object' && !Array.isArray(customCoinCas)
      ? Object.entries(customCoinCas)
      : [];

    for (const [sym, ca] of caEntries) {
      if (!ca) continue;
      const dex = await fetchDexScreener(ca);
      if (!dex) continue;
      const { symbol, price, change1h, change6h, change24h, volume24h, liquidity } = dex;
      const openPosition = openPositions.find((t) => t.coin === symbol);

      let bullishSignals = 0;
      if (change1h > 3) bullishSignals++;
      if (change6h > 8) bullishSignals++;
      if (change24h > 15) bullishSignals++;
      if (volume24h > 50000) bullishSignals++;
      if (liquidity > 20000) bullishSignals++;

      const rand = Math.random();
      let action = 'HOLD';
      if (openPosition) {
        const changePct = ((price - openPosition.entry_price) / openPosition.entry_price) * 100;
        if (changePct >= takeProfitPct || changePct <= -stopLossPct) action = 'CLOSE';
        else if (rand < 0.15) action = 'CLOSE';
      } else {
        if (bullishSignals >= 3 && !blockNewBuys && openPositions.length < maxPositions && rand < 0.3) action = 'BUY';
      }

      const tradeSize = (cashBalance * positionSizePct) / 100;
      if (action === 'BUY' && cashBalance >= tradeSize && tradeSize > 0) {
        cashBalance -= tradeSize; investedValue += tradeSize;
        await supabase.from('trades').insert({
          agent_id: agentId, user_id: userId, coin: symbol, type: 'buy',
          entry_price: price, amount: parseFloat(tradeSize.toFixed(2)), status: 'open',
          reasoning: `MEME BUY — ${bullishSignals}/5 signals. 1h:${change1h}% 24h:${change24h}%`,
        });
        tradeResults.push({ action: 'BUY', coin: symbol, price, amount: tradeSize, meme: true });
      }
      if (action === 'CLOSE' && openPosition) {
        const pnlPct = (price - openPosition.entry_price) / openPosition.entry_price;
        const pnl = openPosition.amount * pnlPct;
        cashBalance += openPosition.amount + pnl;
        investedValue = Math.max(0, investedValue - openPosition.amount);
        await supabase.from('trades').update({
          status: 'closed', exit_price: price,
          pnl: parseFloat(pnl.toFixed(2)), closed_at: new Date().toISOString(),
        }).eq('id', openPosition.id);
        tradeResults.push({ action: 'CLOSE', coin: symbol, price, pnl });
      }
    }

    // ── Polymarket Betting ────────────────────────────────────────────
    let polyResult = null;
    try {
      const markets = await fetchPolymarketMarkets();
      if (markets.length > 0) {
        const { data: openBets } = await supabase
          .from('polymarket_bets')
          .select('id, stake, created_at, odds, potential_payout, outcome')
          .eq('agent_id', agentId)
          .eq('status', 'open');

        // Auto-resolve old bets
        for (const bet of openBets || []) {
          const ageInDays = (Date.now() - new Date(bet.created_at).getTime()) / 86400000;
          if (ageInDays > 7) {
            const won = Math.random() < (bet.odds || 0.5);
            const pnl = won ? bet.potential_payout - bet.stake : -bet.stake;
            await supabase.from('polymarket_bets').update({
              status: 'resolved', result: won ? 'win' : 'loss',
              pnl: parseFloat(pnl.toFixed(2)), resolved_at: new Date().toISOString(),
            }).eq('id', bet.id);
            polyBalance = Math.max(0, polyBalance - bet.stake);
            if (won) cashBalance += bet.potential_payout;
          }
        }

        // Place new bet — 12% chance, max 3 open
        const openBetCount = (openBets || []).filter(b => {
          const age = (Date.now() - new Date(b.created_at).getTime()) / 86400000;
          return age <= 7;
        }).length;

        if (openBetCount < 3 && Math.random() < 0.12 && cashBalance > 150) {
          const market = markets[Math.floor(Math.random() * markets.length)];
          const outcomes = market.outcomes || ['Yes', 'No'];
          const prices_ = market.outcomePrices || ['0.5', '0.5'];
          const idx = Math.random() < 0.4 ? 1 : 0;
          const outcome = outcomes[idx];
          const odds = parseFloat(prices_[idx]) || 0.5;
          const maxStake = Math.min(cashBalance * 0.04, 250);
          const stake = parseFloat(Math.max(50, maxStake).toFixed(2));
          const potentialPayout = parseFloat((stake / odds).toFixed(2));

          cashBalance -= stake;
          polyBalance += stake;

          const { error: betErr } = await supabase.from('polymarket_bets').insert({
            agent_id: agentId, user_id: userId,
            market_id: market.id, question: market.question,
            outcome, odds, stake, potential_payout: potentialPayout, status: 'open',
            reasoning: `Bet — ${(odds * 100).toFixed(0)}% implied prob. Payout: $${potentialPayout.toFixed(0)}`,
          });

          if (!betErr) {
            polyResult = { action: 'BET', market: market.question, outcome, stake, odds, potential_payout: potentialPayout };
          } else {
            cashBalance += stake; polyBalance -= stake;
          }
        }
      }
    } catch (polyErr) {
      console.error('Polymarket error:', polyErr.message);
    }

    // ── Update agent balances ─────────────────────────────────────────
    const { data: allClosed } = await supabase
      .from('trades').select('pnl').eq('agent_id', agentId).eq('status', 'closed');

    const closedCount = allClosed?.length || 0;
    const wins = allClosed?.filter((t) => t.pnl > 0).length || 0;
    const winRate = closedCount > 0 ? parseFloat(((wins / closedCount) * 100).toFixed(1)) : 0;
    const portfolioValue = cashBalance + investedValue + polyBalance;
    const totalReturn = parseFloat((((portfolioValue - 10000) / 10000) * 100).toFixed(2));

    await supabase.from('agents').update({
      cash_balance:       parseFloat(cashBalance.toFixed(2)),
      invested_value:     parseFloat(Math.max(0, investedValue).toFixed(2)),
      polymarket_balance: parseFloat(Math.max(0, polyBalance).toFixed(2)),
      portfolio_value:    parseFloat(portfolioValue.toFixed(2)),
      win_rate: winRate, total_return: totalReturn, status: 'active',
    }).eq('id', agentId);

    // ── Return in the format the old AgentDetail expects ─────────────
    const firstTrade = tradeResults[0];
    return NextResponse.json({
      // Old format fields (for thought log compatibility)
      action:    firstTrade?.action || 'HOLD',
      coin:      firstTrade?.coin   || null,
      price:     firstTrade?.price  || null,
      amount:    firstTrade?.amount || null,
      confidence: 7,
      reasoning: tradeResults.length
        ? tradeResults.map(t => `${t.action} ${t.coin}`).join(', ')
        : 'No trades this scan.',
      trade: firstTrade?.pnl != null ? { pnl: firstTrade.pnl } : null,
      // New fields
      success:   true,
      trades:    tradeResults,
      polymarket: polyResult,
      fearGreed,
      portfolio: { cash: cashBalance, invested: investedValue, polymarket: polyBalance, total: portfolioValue },
    });

  } catch (err) {
    console.error('Trade route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}