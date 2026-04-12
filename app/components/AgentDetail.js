'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const COIN_OPTIONS = ['BTC','ETH','SOL','BNB','DOGE','ADA','XRP','AVAX','MATIC','LINK','DOT','SHIB','PEPE','WIF','BONK'];
const SCAN_INTERVAL_MS = 60000;

export default function AgentDetail({ agentId, userId, onBack }) {
  const [agent, setAgent] = useState(null);
  const [trades, setTrades] = useState([]);
  const [polyBets, setPolyBets] = useState([]);
  const [polyMarkets, setPolyMarkets] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [scanLog, setScanLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTrades, setShowTrades] = useState(false);
  const [showBets, setShowBets] = useState(false);
  const [editingCoins, setEditingCoins] = useState(false);
  const [selectedCoins, setSelectedCoins] = useState([]);
  const [customCA, setCustomCA] = useState('');
  const [customCAs, setCustomCAs] = useState([]);
  const [saving, setSaving] = useState(false);

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const priceStoreRef = useRef(null);

  // ── Load agent ──────────────────────────────────────────────────────
  const loadAgent = useCallback(async () => {
    const { data } = await supabase.from('agents').select('*').eq('id', agentId).single();
    if (data) {
      setAgent(data);
      setSelectedCoins(data.coins || []);
      setCustomCAs(data.custom_coin_cas || []);
    }
    setLoading(false);
  }, [agentId]);

  // ── Load trades ─────────────────────────────────────────────────────
  const loadTrades = useCallback(async () => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(50);
    setTrades(data || []);
  }, [agentId]);

  // ── Load Polymarket bets ────────────────────────────────────────────
  const loadPolyBets = useCallback(async () => {
    const res = await fetch(`/api/polymarket?type=bets&agentId=${agentId}`);
    const data = await res.json();
    setPolyBets(data.bets || []);
  }, [agentId]);

  // ── Load live Polymarket markets ────────────────────────────────────
  const loadPolyMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/polymarket?type=markets');
      const data = await res.json();
      setPolyMarkets(data.markets || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadAgent();
    loadTrades();
    loadPolyBets();
    loadPolyMarkets();
  }, [loadAgent, loadTrades, loadPolyBets, loadPolyMarkets]);

  // ── Run one scan ────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    if (!agent) return;

    const timestamp = new Date().toLocaleTimeString();
    setScanLog((prev) => [`[${timestamp}] Scanning ${(agent.coins || []).length} coins + Polymarket...`, ...prev.slice(0, 19)]);

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          userId,
          coins: agent.coins || [],
          riskSettings: agent.risk_settings || {},
          behaviorSettings: agent.behavior_settings || {},
          customCoinCAs: agent.custom_coin_cas || [],
          cachedPrices: {},
        }),
      });
      const result = await res.json();

      if (result.success) {
        setLastScan(new Date());
        await loadAgent();
        await loadTrades();
        await loadPolyBets();

        const actions = result.trades || [];
        const polyAction = result.polymarket;

        const tradeMsg = actions.length
          ? actions.map((t) => `${t.action} ${t.coin} @ $${typeof t.price === 'number' ? t.price.toFixed(2) : t.price}`).join(', ')
          : 'No trades';

        const polyMsg = polyAction
          ? ` | BET: "${polyAction.market?.slice(0, 40)}..." → ${polyAction.outcome} ($${polyAction.stake})`
          : '';

        setScanLog((prev) => [`[${timestamp}] ${tradeMsg}${polyMsg}`, ...prev.slice(0, 19)]);

        if (result.fearGreed) {
          setScanLog((prev) => [
            `[${timestamp}] Fear & Greed: ${result.fearGreed.value} — ${result.fearGreed.value_classification}`,
            ...prev.slice(0, 19),
          ]);
        }
      }
    } catch (err) {
      setScanLog((prev) => [`[${timestamp}] ERROR: ${err.message}`, ...prev.slice(0, 19)]);
    }
  }, [agent, agentId, userId, loadAgent, loadTrades, loadPolyBets]);

  // ── Start / Stop ────────────────────────────────────────────────────
  const startTrading = useCallback(() => {
    setIsRunning(true);
    runScan();
    setCountdown(SCAN_INTERVAL_MS / 1000);
    intervalRef.current = setInterval(() => {
      runScan();
      setCountdown(SCAN_INTERVAL_MS / 1000);
    }, SCAN_INTERVAL_MS);
    countdownRef.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
  }, [runScan]);

  const stopTrading = useCallback(async () => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    await supabase.from('agents').update({ status: 'paused' }).eq('id', agentId);
    await loadAgent();
  }, [agentId, loadAgent]);

  useEffect(() => () => { clearInterval(intervalRef.current); clearInterval(countdownRef.current); }, []);

  // ── Save coins ──────────────────────────────────────────────────────
  const saveCoins = async () => {
    setSaving(true);
    await supabase.from('agents').update({
      coins: selectedCoins,
      custom_coin_cas: customCAs,
    }).eq('id', agentId);
    await loadAgent();
    setEditingCoins(false);
    setSaving(false);
  };

  const addCustomCA = () => {
    const trimmed = customCA.trim();
    if (trimmed && !customCAs.includes(trimmed)) {
      setCustomCAs((prev) => [...prev, trimmed]);
      setCustomCA('');
    }
  };

  // ── Forum toggles ───────────────────────────────────────────────────
  const toggleForum = async (key) => {
    const current = agent?.forum_settings || {};
    const updated = { ...current, [key]: !current[key] };
    await supabase.from('agents').update({ forum_settings: updated }).eq('id', agentId);
    setAgent((prev) => ({ ...prev, forum_settings: updated }));
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 text-sm animate-pulse">Loading agent...</div>
    </div>
  );

  if (!agent) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-red-400">Agent not found.</div>
    </div>
  );

  const cash = agent.cash_balance ?? 0;
  const invested = agent.invested_value ?? 0;
  const poly = agent.polymarket_balance ?? 0;
  const total = agent.portfolio_value ?? 10000;
  const totalReturn = agent.total_return ?? 0;
  const winRate = agent.win_rate ?? 0;

  const cashPct = total > 0 ? (cash / total) * 100 : 0;
  const investedPct = total > 0 ? (invested / total) * 100 : 0;
  const polyPct = total > 0 ? (poly / total) * 100 : 0;

  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const openBets = polyBets.filter((b) => b.status === 'open');
  const resolvedBets = polyBets.filter((b) => b.status === 'resolved');
  const polyWins = resolvedBets.filter((b) => b.result === 'win').length;
  const polyWinRate = resolvedBets.length > 0 ? ((polyWins / resolvedBets.length) * 100).toFixed(0) : '—';

  const forums = agent.forum_settings || {};

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-500 hover:text-white transition text-sm">← Back</button>
            <div>
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className="text-xs text-gray-400">{isRunning ? `Scanning in ${countdown}s` : 'Paused'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={isRunning ? stopTrading : startTrading}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
              isRunning
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isRunning ? '⏸ Pause' : '▶ Start'}
          </button>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Portfolio Value</div>
            <div className="text-xl font-bold text-white">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Total Return</div>
            <div className={`text-xl font-bold ${totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Crypto Win Rate</div>
            <div className="text-xl font-bold text-blue-400">{winRate}%</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Poly Win Rate</div>
            <div className="text-xl font-bold text-purple-400">
              {polyWinRate === '—' ? '—' : `${polyWinRate}%`}
            </div>
          </div>
        </div>

        {/* ── Portfolio Breakdown (3-way) ── */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="text-sm font-semibold text-gray-300 mb-4">Portfolio Allocation</div>

          {/* Bar */}
          <div className="h-3 rounded-full overflow-hidden flex mb-4 bg-gray-800">
            {cashPct > 0 && (
              <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${cashPct}%` }} />
            )}
            {investedPct > 0 && (
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${investedPct}%` }} />
            )}
            {polyPct > 0 && (
              <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${polyPct}%` }} />
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-400">Cash</span>
              </div>
              <div className="text-sm font-bold text-white">${cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-gray-500">{cashPct.toFixed(1)}%</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-400">Crypto</span>
              </div>
              <div className="text-sm font-bold text-white">${invested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-gray-500">{investedPct.toFixed(1)}%</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-xs text-gray-400">Polymarket</span>
              </div>
              <div className="text-sm font-bold text-white">${poly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-gray-500">{polyPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* ── Open Positions ── */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="text-sm font-semibold text-gray-300 mb-3">
            Open Positions ({openTrades.length})
          </div>
          {openTrades.length === 0 ? (
            <div className="text-xs text-gray-600">No open positions</div>
          ) : (
            <div className="space-y-2">
              {openTrades.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-0.5 rounded">LONG</div>
                    <span className="text-sm font-semibold text-white">{t.coin}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Entry ${t.entry_price?.toFixed(4)}</div>
                    <div className="text-xs text-gray-500">${t.amount?.toFixed(2)} at risk</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Coins Being Watched ── */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-300">Coins Watched</div>
            <button
              onClick={() => setEditingCoins(!editingCoins)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {editingCoins ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {!editingCoins ? (
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(agent.coins) ? agent.coins : []).map((c) => (
                <span key={c} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1 rounded-full">{c}</span>
              ))}
              {(Array.isArray(agent.custom_coin_cas) ? agent.custom_coin_cas : []).map((ca) => (
                <span key={ca} className="text-xs bg-purple-900/40 border border-purple-700 text-purple-300 px-2.5 py-1 rounded-full">
                  CA: {ca.slice(0, 6)}…
                </span>
              ))}
              {(!agent.coins?.length && !agent.custom_coin_cas?.length) && (
                <span className="text-xs text-gray-600">None selected</span>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {COIN_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      setSelectedCoins((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                      )
                    }
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      selectedCoins.includes(c)
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-2">Custom Contract Address (meme coins)</div>
                <div className="flex gap-2">
                  <input
                    value={customCA}
                    onChange={(e) => setCustomCA(e.target.value)}
                    placeholder="Paste contract address..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500"
                  />
                  <button onClick={addCustomCA} className="px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg text-xs text-white">
                    Add
                  </button>
                </div>
                {customCAs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customCAs.map((ca) => (
                      <div key={ca} className="flex items-center gap-1 bg-purple-900/40 border border-purple-700 rounded-full px-2 py-1">
                        <span className="text-xs text-purple-300">{ca.slice(0, 8)}…</span>
                        <button onClick={() => setCustomCAs((prev) => prev.filter((x) => x !== ca))} className="text-purple-500 hover:text-red-400 text-xs">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={saveCoins}
                disabled={saving}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Coins'}
              </button>
            </div>
          )}
        </div>

        {/* ── Forum Sentiment Toggles ── */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="text-sm font-semibold text-gray-300 mb-3">Forum Sentiment</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'reddit', label: 'Reddit', icon: '🟠' },
              { key: 'fourchan', label: '4chan /biz/', icon: '🟢' },
              { key: 'cryptopanic', label: 'CryptoPanic', icon: '🔴' },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => toggleForum(key)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition ${
                  forums[key]
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
                <span className="ml-auto">{forums[key] ? '✓' : '○'}</span>
              </button>
            ))}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-700 text-xs text-gray-400 bg-gray-800/50">
              <span>📊</span>
              <span>Fear & Greed</span>
              <span className="ml-auto text-emerald-400">Always on</span>
            </div>
          </div>
        </div>

        {/* ── Polymarket Section ── */}
        <div className="bg-gray-900 rounded-xl p-5 border border-purple-900/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <div>
                <div className="text-sm font-semibold text-white">Polymarket Bets</div>
                <div className="text-xs text-gray-500">{openBets.length} open · {resolvedBets.length} resolved · Win rate: {polyWinRate === '—' ? 'No data yet' : `${polyWinRate}%`}</div>
              </div>
            </div>
            <button
              onClick={() => setShowBets(!showBets)}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              {showBets ? 'Hide' : 'Show all'}
            </button>
          </div>

          {/* Open Bets */}
          {openBets.length === 0 ? (
            <div className="text-xs text-gray-600 mb-4">
              No open bets — agent will place bets automatically when running
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {(showBets ? openBets : openBets.slice(0, 3)).map((bet) => (
                <div key={bet.id} className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-3">
                  <div className="text-xs text-purple-200 font-medium mb-1 line-clamp-2">{bet.question}</div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="bg-purple-700/40 text-purple-300 px-2 py-0.5 rounded font-semibold">{bet.outcome}</span>
                    <span>Stake: <span className="text-white">${bet.stake?.toFixed(2)}</span></span>
                    <span>Payout: <span className="text-emerald-400">${bet.potential_payout?.toFixed(2)}</span></span>
                    <span>Odds: <span className="text-gray-300">{(bet.odds * 100).toFixed(0)}%</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resolved Bets (show when expanded) */}
          {showBets && resolvedBets.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="text-xs text-gray-500 font-semibold">Resolved</div>
              {resolvedBets.slice(0, 5).map((bet) => (
                <div key={bet.id} className={`rounded-lg p-3 border ${bet.result === 'win' ? 'bg-emerald-900/20 border-emerald-800/40' : 'bg-red-900/20 border-red-800/40'}`}>
                  <div className="text-xs text-gray-300 mb-1 line-clamp-1">{bet.question}</div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`font-bold ${bet.result === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bet.result === 'win' ? '✓ WIN' : '✗ LOSS'}
                    </span>
                    <span className={`${bet.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bet.pnl >= 0 ? '+' : ''}${bet.pnl?.toFixed(2)}
                    </span>
                    <span className="text-gray-500">{bet.outcome}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live Markets Preview */}
          {polyMarkets.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 font-semibold mb-2">Live Markets Agent Can Bet On</div>
              <div className="space-y-1.5">
                {polyMarkets.slice(0, 4).map((m) => {
                  const prices = m.outcomePrices || ['0.5', '0.5'];
                  const yesProb = Math.round(parseFloat(prices[0]) * 100);
                  const noProb = Math.round(parseFloat(prices[1]) * 100);
                  return (
                    <div key={m.id} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2">
                      <div className="text-xs text-gray-300 truncate flex-1 mr-3">{m.question}</div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                        <span className="text-emerald-400 font-semibold">Yes {yesProb}%</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-red-400 font-semibold">No {noProb}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Trade History ── */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <button
            onClick={() => setShowTrades(!showTrades)}
            className="flex items-center justify-between w-full"
          >
            <div className="text-sm font-semibold text-gray-300">
              Trade History ({closedTrades.length} closed)
            </div>
            <span className="text-gray-500 text-xs">{showTrades ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {showTrades && (
            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
              {closedTrades.length === 0 ? (
                <div className="text-xs text-gray-600">No closed trades yet</div>
              ) : (
                closedTrades.map((t) => (
                  <div key={t.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.pnl >= 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                        {t.pnl >= 0 ? '▲' : '▼'} {t.coin}
                      </span>
                      <span className="text-xs text-gray-500">${t.entry_price?.toFixed(4)} → ${t.exit_price?.toFixed(4)}</span>
                    </div>
                    <div className={`text-sm font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Scan Log ── */}
        {scanLog.length > 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 font-semibold mb-2">Activity Log</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {scanLog.map((line, i) => (
                <div key={i} className={`text-xs font-mono ${i === 0 ? 'text-gray-300' : 'text-gray-600'}`}>{line}</div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}