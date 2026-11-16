// Token Launch Radar: Valuation Model & Pipeline
//
// Translates DefiLlama protocol snapshots into implied token launch valuations and actionable
// farm plans. Covers 100% of the watchlist plus high-potential early pre-token protocols below the
// watchlist floor, sorted strictly descending by implied_value_usd.
//
// The implied valuation model computes:
//   base       = tvl_usd x category_multiplier x chain_multiplier
//   growthMult = 1 + (clamp(change_7d, growth_floor, growth_cap) / 100) x growth_weight
//   maturity   = maturity_floor + (min(age_days, maturity_days) / maturity_days) x maturity_range
//   implied    = max(1, round(base x growthMult x maturity))

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.28,
  growth_weight: 0.45,
  growth_floor: -60,
  growth_cap: 140,
  maturity_floor: 0.65,
  maturity_range: 0.35,
  maturity_days: 730,
  unknown_age_days: 365,
};

export const MODEL_VERSION = 'radar-v2';
export const EARLY_ROWS = 160;
export const LIVE_ROWS = 24;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  tier: 'Tier S' | 'Tier A' | 'Tier B' | 'Tier C';
  implied_value_usd: number;
  model: {
    base_multiple: number;
    category_multiplier: number;
    chain_multiplier: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  tier: 'Tier S' | 'Tier A' | 'Tier B' | 'Tier C';
  implied_value_usd: number;
  category_multiplier: number;
  chain_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Sector-specific capital efficiency & token valuation multiplier. */
export function categoryMultiplier(category: string | null): number {
  const c = (category ?? '').toLowerCase();
  if (c.includes('ai') || c.includes('agent')) return 0.50; // AI agent protocols & decentralized compute have high market narrative velocity
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('option') || c.includes('basis') || c.includes('synthetic')) return 0.46;
  if (c.includes('restak') || c.includes('staking')) return 0.42; // Yield infrastructure & security layers
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 0.38; // High TVL stickiness
  if (c.includes('chain')) return 0.40; // L1/L2 networks command high FDVs
  if (c.includes('dex') || c.includes('swap') || c.includes('amm') || c.includes('liquidity manager')) return 0.35;
  if (c.includes('rwa') || c.includes('real world')) return 0.36; // Real World Assets institutional inflow
  if (c.includes('prediction')) return 0.34;
  if (c.includes('bridge') || c.includes('cross chain')) return 0.32;
  if (c.includes('yield') || c.includes('farm') || c.includes('allocator') || c.includes('curator') || c.includes('index')) return 0.30;
  if (c.includes('stable') || c.includes('payments')) return 0.29;
  return 0.28;
}

/** Chain network liquidity, security budget & ecosystem valuation multiple. */
export function chainMultiplier(chains: string[]): number {
  if (!chains || chains.length === 0) return 1.0;
  let maxChainMult = 1.0;
  for (const chain of chains) {
    const ch = chain.toLowerCase();
    if (ch === 'ethereum') maxChainMult = Math.max(maxChainMult, 1.20);
    else if (ch === 'solana') maxChainMult = Math.max(maxChainMult, 1.16);
    else if (ch === 'base') maxChainMult = Math.max(maxChainMult, 1.12);
    else if (ch === 'arbitrum') maxChainMult = Math.max(maxChainMult, 1.08);
    else if (ch === 'binance' || ch === 'bsc') maxChainMult = Math.max(maxChainMult, 1.06);
    else if (ch === 'polygon') maxChainMult = Math.max(maxChainMult, 1.04);
  }
  const multiBonus = chains.length >= 3 ? 0.08 : chains.length === 2 ? 0.04 : 0.0;
  return Math.round((maxChainMult + multiBonus) * 100) / 100;
}

export function computeTier(implied: number, tvl: number, onWatchlist: boolean): 'Tier S' | 'Tier A' | 'Tier B' | 'Tier C' {
  if (implied >= 100_000_000 || (onWatchlist && tvl >= 100_000_000)) return 'Tier S';
  if (implied >= 30_000_000 || (onWatchlist && tvl >= 30_000_000)) return 'Tier A';
  if (implied >= 10_000_000) return 'Tier B';
  return 'Tier C';
}

export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): {
  implied: number;
  catMult: number;
  chainMult: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;

  const catMult = categoryMultiplier(protocol.category);
  const chMult = chainMultiplier(protocol.chains);

  const base = protocol.tvl_usd * catMult * chMult;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, catMult, chainMult: chMult, growthPct, growthMult, maturityMult, age };
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();

  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }

  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const watchlistSet = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => {
    const metrics = impliedValue(p, snapshot.as_of, model);
    const tier = computeTier(metrics.implied, p.tvl_usd, watchlistSet.has(p.slug));
    return { p, tier, ...metrics };
  });

  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    tier: s.tier,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      category_multiplier: round4(s.catMult),
      chain_multiplier: round4(s.chainMult),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its primary deployment chain';
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  return 75;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} USDC as primary collateral on ${name} (${chain}) and maintain a healthy borrow ratio under 45% LTV to maximize points.`;
  }
  if (c.includes('dex') || c.includes('swap') || c.includes('amm')) {
    return `Provide $${capital} liquidity into the primary concentrated pool (e.g. USDC/ETH or USDC/SOL) on ${name} (${chain}) and capture swap fees.`;
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return `Route a minimum of $${capital} cross-chain volume through ${name} to ${chain}, utilizing official liquidity routes and retaining proof in wallet.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} equivalent in native assets through ${name} on ${chain}, receive the receipt liquid token, and re-deposit into whitelisted partner vaults.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return `Deposit $${capital} USDC into ${name} perpetual margin account on ${chain}, execute at least $1,000 in delta-neutral volume, and maintain open limit orders.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} into ${name} prediction markets on ${chain} and place diversified orders across at least 3 active resolution contracts.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield')) {
    return `Allocate $${capital} into a high-security risk-adjusted vault on ${name} (${chain}) and keep vault receipt tokens staked.`;
  }
  if (c.includes('rwa') || c.includes('real world')) {
    return `Complete KYC verification if mandated, mint $${capital} worth of ${name} yield-bearing RWA tokens on ${chain}, and hold in self-custody.`;
  }
  return `Deposit $${capital} liquidity or collateral into ${name}'s flagship contract on ${chain} and keep the position active.`;
}

export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const name = p.name;

  return [
    {
      text: `Establish an isolated clean EVM/SVM wallet dedicated solely to ${name} on ${chain}, funding gas directly via non-custodial bridge or CEX.`,
      cost: 'Gas fee under $2 on L2/Solana, or ~$6 on Ethereum',
      time: '10 minutes setup',
    },
    {
      text: action,
      cost: `$${capital} allocated principal plus ~$${capital >= 250 ? 10 : 4} in network execution gas`,
      time: '15 to 20 minutes',
    },
    {
      text: `Execute regular qualifying on-chain cadence: perform 1 micro-interaction (rebalancing, compounding, voting, or adding $10 volume) every 7 days on ${chain}.`,
      cost: 'Approx $1 to $3 gas per week depending on chain congestion',
      time: '5 minutes weekly',
    },
    {
      text: `Maintain the active staking/liquidity position for a minimum of ${hold} consecutive days to qualify across multiple snapshot cutoff blocks.`,
      cost: `Principal of $${capital} held non-withdrawn; opportunity cost of capital`,
      time: `${hold} days retention`,
    },
    {
      text: `Monitor official ${name} governance forums and discord announcements for snapshot block notices, points multiplier epochs, or referral badges.`,
      cost: 'Zero financial cost (never pay fee-demanding claim links)',
      time: '5 minutes every few days',
    },
    {
      text: `Upon token generation event (TGE), claim allocation exclusively from ${name}'s verified domain, immediately revoke approvals, and record tx in tax tracker.`,
      cost: 'Standard gas for claim transaction (~$3-$8)',
      time: '10 minutes post-TGE',
    },
  ];
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    tier: row.tier,
    implied_value_usd: row.implied_value_usd,
    category_multiplier: row.model.category_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
