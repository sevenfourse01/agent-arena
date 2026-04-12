import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CRYPTO_KEYWORDS = [
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol',
  'crypto', 'doge', 'xrp', 'coinbase', 'binance', 'altcoin',
  'memecoin', 'defi', 'nft', 'blockchain', 'token'
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'markets';
  const agentId = searchParams.get('agentId');

  // --- Return live crypto-relevant Polymarket markets ---
  if (type === 'markets') {
    try {
      const res = await fetch(
        'https://gamma-api.polymarket.com/markets?limit=100&active=true',
        { headers: { Accept: 'application/json' }, next: { revalidate: 300 } }
      );
      if (!res.ok) throw new Error('Polymarket API failed');
      const all = await res.json();

      const crypto = (Array.isArray(all) ? all : [])
        .filter((m) => {
          const q = (m.question || '').toLowerCase();
          return CRYPTO_KEYWORDS.some((kw) => q.includes(kw));
        })
        .slice(0, 8)
        .map((m) => ({
          id: m.id || m.conditionId,
          question: m.question,
          outcomes: m.outcomes || ['Yes', 'No'],
          outcomePrices: m.outcomePrices || ['0.5', '0.5'],
          endDate: m.endDate,
          volume: m.volume || 0,
          liquidity: m.liquidity || 0,
        }));

      return NextResponse.json({ markets: crypto });
    } catch (err) {
      console.error('Polymarket fetch error:', err.message);
      return NextResponse.json({ markets: [], error: err.message });
    }
  }

  // --- Return bets for a specific agent ---
  if (type === 'bets' && agentId) {
    const { data: bets, error } = await supabase
      .from('polymarket_bets')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return NextResponse.json({ bets: [], error: error.message });
    return NextResponse.json({ bets: bets || [] });
  }

  // --- Try to resolve expired bets for an agent ---
  if (type === 'resolve' && agentId) {
    const { data: openBets } = await supabase
      .from('polymarket_bets')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'open');

    if (!openBets?.length) return NextResponse.json({ resolved: 0 });

    let resolved = 0;
    const { data: agent } = await supabase
      .from('agents')
      .select('cash_balance, polymarket_balance')
      .eq('id', agentId)
      .single();

    let cashBalance = agent?.cash_balance || 0;
    let polyBalance = agent?.polymarket_balance || 0;

    for (const bet of openBets) {
      const ageInDays =
        (Date.now() - new Date(bet.created_at).getTime()) / 86400000;

      // Simulate resolution for bets older than 7 days
      if (ageInDays > 7) {
        const won = Math.random() < (bet.odds || 0.5);
        const pnl = won ? bet.potential_payout - bet.stake : -bet.stake;

        await supabase
          .from('polymarket_bets')
          .update({
            status: 'resolved',
            result: won ? 'win' : 'loss',
            pnl: parseFloat(pnl.toFixed(2)),
            resolved_at: new Date().toISOString(),
          })
          .eq('id', bet.id);

        // Move stake out of polymarket_balance
        polyBalance = Math.max(0, polyBalance - bet.stake);

        // If won, add payout to cash
        if (won) cashBalance += bet.potential_payout;

        resolved++;
      }
    }

    if (resolved > 0) {
      await supabase
        .from('agents')
        .update({
          cash_balance: parseFloat(cashBalance.toFixed(2)),
          polymarket_balance: parseFloat(polyBalance.toFixed(2)),
        })
        .eq('id', agentId);
    }

    return NextResponse.json({ resolved });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}