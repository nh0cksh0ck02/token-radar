// Token Radar Valuation & Farming Strategy Model
// Analyzes DefiLlama snapshots to compute implied token valuations and actionable farming plans.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | number | null;
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
  minRows: number;
  targetRows: number;
  maxRows: number;
  categoryMultipliers: Record<string, number>;
  defaultMultiplier: number;
  watchlistPrestigeBonus: number;
  minValuationUsd: number;
  maxValuationUsd: number;
}

export const MODEL: ModelConstants = {
  minRows: 100,
  targetRows: 200,
  maxRows: 4000,
  categoryMultipliers: {
    'Dexes': 2.45,
    'Lending': 1.95,
    'Derivatives': 2.85,
    'Yield': 1.75,
    'Services': 1.65,
    'Liquid Staking': 1.55,
    'Cross Chain': 1.85,
    'Bridge': 1.5,
    'RWA': 2.3,
    'Indexes': 1.45,
    'Farm': 1.35,
  },
  defaultMultiplier: 1.5,
  watchlistPrestigeBonus: 1.25,
  minValuationUsd: 10_000,
  maxValuationUsd: 100_000_000_000_000,
};

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category?: string | null;
  chains?: string[];
  tvl_usd?: number;
  tier?: string;
  on_watchlist?: boolean;
}

export interface RadarRow extends BoardRow {
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | number | null;
  on_watchlist: boolean;
  tier: 'Apex' | 'High' | 'Mid' | 'Early';
  est_allocation_usd: number;
  fdv_tvl_ratio: number;
  risk_level: 'Low' | 'Medium' | 'High';
}

export interface LiveRow {
  slug: string;
  name: string;
  implied_value_usd: number;
  rank: number;
  tier: string;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  total_protocols: number;
  watchlist_count: number;
  scored_count: number;
  total_implied_value_usd: number;
  rows: RadarRow[];
}

export function farmSteps(protocol: SnapshotProtocol, impliedValue: number): string[] {
  const cat = protocol.category ?? 'DeFi';
  const primaryChain = protocol.chains.length > 0 ? protocol.chains[0] : 'Ethereum';
  const isHighValue = impliedValue >= 500_000_000;
  const capital = isHighValue ? '$500-$2,000' : '$150-$500';

  if (cat.includes('Dex') || cat.includes('AMM')) {
    return [
      `Deploy ${capital} liquidity into the primary high-volume trading pair for at least 30 continuous days to generate LP fee share (Gas: ~$5-$15 on ${primaryChain}).`,
      `Execute 5 to 10 automated cross-pool swaps across multiple distinct weeks to establish regular wallet volume and retention activity (Gas: ~$2-$8).`,
      `Deposit LP LP-tokens into the protocol native gauge or booster vault to maximize point generation and liquidity loyalty tier (Gas: ~$4-$10).`,
      `Vote in active governance snapshot rounds or gauge proposals every bi-weekly epoch to secure protocol voting power weighting (Gas: $0 via snapshot).`
    ];
  }

  if (cat.includes('Lending') || cat.includes('CDP')) {
    return [
      `Supply ${capital} in blue-chip collateral (ETH, WBTC or stablecoins) into the protocol primary lending market for 45+ days (Gas: ~$8-$20 on ${primaryChain}).`,
      `Borrow 30% to 50% LTV against deposited collateral and deposit borrowed assets into stability or earn pools to double points velocity (Gas: ~$6-$14).`,
      `Perform recurring debt balancing every two weeks to maintain a safe collateralization ratio above 180% (Gas: ~$4-$10).`,
      `Participate in liquidation incentive testing or reserve backstop pools if eligible to qualify for community safety allocation (Gas: ~$5-$12).`
    ];
  }

  if (cat.includes('Derivatives') || cat.includes('Perp') || cat.includes('Options')) {
    return [
      `Deposit ${capital} into the protocol liquidity provider vault (e.g. index vault or market-making pool) for minimum 30 days (Gas: ~$6-$18 on ${primaryChain}).`,
      `Open and manage 3 to 5 hedged perpetual positions with at least $1,000 cumulative trading volume across separate weekly sessions (Gas: ~$5-$15).`,
      `Utilize limit and stop-loss order features to register interactions with advanced protocol order routing contracts (Gas: ~$3-$8).`,
      `Complete protocol verification quests or maintain vault LP positions through monthly epoch transition snapshots (Gas: $0).`
    ];
  }

  if (cat.includes('Yield') || cat.includes('Farm') || cat.includes('Staking')) {
    return [
      `Stake ${capital} into automated yield-compounding vaults for a minimum duration of 60 consecutive days (Gas: ~$5-$16 on ${primaryChain}).`,
      `Harvest or compound earned rewards across multiple settlement cycles to record sustained user activity on-chain (Gas: ~$3-$9).`,
      `Split capital across at least two distinct strategy vaults to diversify risk and capture multi-pool incentive tiers (Gas: ~$8-$18).`,
      `Maintain position through the scheduled token generation event snapshot window to satisfy minimum retention criteria (Gas: $0).`
    ];
  }

  return [
    `Deposit ${capital} into the primary protocol smart contract for at least 30 consecutive days (Gas: ~$5-$15 on ${primaryChain}).`,
    `Execute at least 4 independent protocol state interactions spaced evenly over 4 weeks to demonstrate organic retention (Gas: ~$3-$10).`,
    `Engage with community testnet, cross-chain messaging, or governance telemetry where supported by protocol architecture (Gas: ~$2-$6).`,
    `Hold protocol receipt tokens in a secure non-custodial wallet through the end-of-quarter eligibility snapshot (Gas: $0).`
  ];
}

export function parseSnapshot(jsonString: string): Snapshot {
  const data = JSON.parse(jsonString) as Snapshot;
  if (!Array.isArray(data.protocols) || !Array.isArray(data.watchlist)) {
    throw new Error('Invalid snapshot structure: missing protocols or watchlist array');
  }
  return data;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const watchlistSet = new Set(snapshot.watchlist);
  const asOfTime = new Date(snapshot.as_of).getTime() || Date.now();

  const protocolMap = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) {
    protocolMap.set(p.slug, p);
  }

  const selectedProtocols: SnapshotProtocol[] = [];
  const addedSlugs = new Set<string>();

  // 1. Mandatory: Add all watchlist protocols
  for (const slug of snapshot.watchlist) {
    const p = protocolMap.get(slug);
    if (p && !addedSlugs.has(p.slug)) {
      selectedProtocols.push(p);
      addedSlugs.add(p.slug);
    }
  }

  // 2. Select high-potential pre-token protocols to reach target rows (200)
  const excludedCategories = new Set([
    'CEX',
    'Bridge',
    'Canonical Bridge',
    'Liquid Staking',
    'Liquid Restaking',
    'Restaked BTC',
  ]);
  const excludedPrefixes = [
    'binance',
    'coinbase',
    'bybit',
    'kraken',
    'bitget',
    'okx',
    'bitfinex',
    'gemini',
    'robinhood',
  ];

  const isEligiblePreToken = (p: SnapshotProtocol, strict: boolean) => {
    if (addedSlugs.has(p.slug)) return false;
    if (p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null) return false;
    if (!strict) return true;
    if (p.category && excludedCategories.has(p.category)) return false;
    const lower = p.name.toLowerCase();
    if (excludedPrefixes.some((ex) => lower.startsWith(ex))) return false;
    if (/\b(wrapped|staked|staking)\b/i.test(lower)) return false;
    if (/\s(v2|2\.0)$/i.test(p.name)) return false;
    return true;
  };

  const cleanCandidates = snapshot.protocols
    .filter((p) => isEligiblePreToken(p, true))
    .sort((a, b) => b.tvl_usd - a.tvl_usd);

  let needed = MODEL.targetRows - selectedProtocols.length;
  for (let i = 0; i < needed && i < cleanCandidates.length; i++) {
    const p = cleanCandidates[i];
    selectedProtocols.push(p);
    addedSlugs.add(p.slug);
  }

  // Fallback to broader pre-token set if needed to hit targetRows
  if (selectedProtocols.length < MODEL.targetRows) {
    const fallbackCandidates = snapshot.protocols
      .filter((p) => isEligiblePreToken(p, false))
      .sort((a, b) => b.tvl_usd - a.tvl_usd);
    needed = MODEL.targetRows - selectedProtocols.length;
    for (let i = 0; i < needed && i < fallbackCandidates.length; i++) {
      const p = fallbackCandidates[i];
      selectedProtocols.push(p);
      addedSlugs.add(p.slug);
    }
  }

  // Calculate raw valuation for each protocol
  interface ScoredCandidate {
    protocol: SnapshotProtocol;
    rawValuation: number;
    category: string;
    tvl: number;
    isOnWatchlist: boolean;
  }

  const scoredList: ScoredCandidate[] = selectedProtocols.map((p) => {
    const cat = p.category ?? 'DeFi';
    const mult = MODEL.categoryMultipliers[cat] ?? MODEL.defaultMultiplier;
    const tvl = Math.max(p.tvl_usd, 500_000);

    // Growth multiplier (from change_7d)
    let growthFactor = 1.0;
    if (p.change_7d !== null) {
      if (p.change_7d > 0) {
        growthFactor = 1.0 + Math.min(p.change_7d / 100, 2.0) * 0.4;
      } else {
        growthFactor = Math.max(0.6, 1.0 + (p.change_7d / 100) * 0.25);
      }
    }

    // Maturity bonus based on days listed without a token
    let ageBonus = 1.0;
    if (p.listed_at !== null && p.listed_at !== undefined) {
      const listedTime = typeof p.listed_at === 'number'
        ? p.listed_at * 1000
        : new Date(p.listed_at).getTime();
      if (!isNaN(listedTime)) {
        const days = Math.max(0, (asOfTime - listedTime) / (86400 * 1000));
        ageBonus = 1.0 + Math.min(days / 365, 2.5) * 0.2;
      }
    }

    const isOnWatchlist = watchlistSet.has(p.slug);
    const watchlistMultiplier = isOnWatchlist ? MODEL.watchlistPrestigeBonus : 1.0;

    const rawValuation = tvl * mult * growthFactor * ageBonus * watchlistMultiplier;

    return {
      protocol: p,
      rawValuation,
      category: cat,
      tvl,
      isOnWatchlist,
    };
  });

  // Sort descending by raw valuation, breaking ties deterministically
  scoredList.sort((a, b) => {
    if (b.rawValuation !== a.rawValuation) {
      return b.rawValuation - a.rawValuation;
    }
    if (b.tvl !== a.tvl) {
      return b.tvl - a.tvl;
    }
    return a.protocol.slug.localeCompare(b.protocol.slug);
  });

  // Assign strict descending implied_value_usd and ranks 1..N
  const board: BoardRow[] = [];
  const radarRows: RadarRow[] = [];
  let totalImpliedValue = 0;
  let previousValue = Infinity;

  for (let i = 0; i < scoredList.length; i++) {
    const item = scoredList[i];
    const rank = i + 1;
    let impliedVal = Math.round(item.rawValuation);

    // Enforce strictly descending positive integer values
    if (impliedVal >= previousValue) {
      impliedVal = Math.max(MODEL.minValuationUsd, previousValue - 1000);
    }
    if (impliedVal < MODEL.minValuationUsd) {
      impliedVal = MODEL.minValuationUsd;
    }
    if (impliedVal > MODEL.maxValuationUsd) {
      impliedVal = MODEL.maxValuationUsd;
    }
    previousValue = impliedVal;
    totalImpliedValue += impliedVal;

    const steps = farmSteps(item.protocol, impliedVal);

    let tier: 'Apex' | 'High' | 'Mid' | 'Early';
    if (rank <= 20) tier = 'Apex';
    else if (rank <= 60) tier = 'High';
    else if (rank <= 120) tier = 'Mid';
    else tier = 'Early';

    const fdvTvl = parseFloat((impliedVal / Math.max(item.tvl, 1)).toFixed(2));
    const estAllocation = Math.round(impliedVal * 0.00015);
    const risk: 'Low' | 'Medium' | 'High' = item.tvl > 50_000_000 ? 'Low' : item.tvl > 10_000_000 ? 'Medium' : 'High';

    const bRow: BoardRow = {
      slug: item.protocol.slug,
      name: item.protocol.name,
      rank,
      implied_value_usd: impliedVal,
      farm_steps: steps,
      category: item.category,
      chains: item.protocol.chains,
      tvl_usd: item.protocol.tvl_usd,
      tier,
      on_watchlist: item.isOnWatchlist,
    };
    board.push(bRow);

    const rRow: RadarRow = {
      ...bRow,
      category: item.category,
      chains: item.protocol.chains,
      tvl_usd: item.protocol.tvl_usd,
      change_7d: item.protocol.change_7d,
      listed_at: item.protocol.listed_at,
      on_watchlist: item.isOnWatchlist,
      tier,
      est_allocation_usd: estAllocation,
      fdv_tvl_ratio: fdvTvl,
      risk_level: risk,
    };
    radarRows.push(rRow);
  }

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    total_protocols: snapshot.protocols.length,
    watchlist_count: snapshot.watchlist.length,
    scored_count: board.length,
    total_implied_value_usd: totalImpliedValue,
    rows: radarRows,
  };

  return { board, radar };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (!Array.isArray(board)) return 'board is not an array';
  if (board.length < 100 || board.length > 4000) {
    return `board length ${board.length} is outside allowed range [100, 4000]`;
  }

  const knownSlugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seenSlugs = new Set<string>();
  const seenRanks = new Set<number>();
  let prevValue = Infinity;
  let allSame = true;
  let firstValue: number | null = null;

  for (let i = 0; i < board.length; i++) {
    const row = board[i];
    if (!row || typeof row !== 'object') return `row ${i} is not an object`;
    if (typeof row.slug !== 'string' || row.slug.length === 0 || row.slug.length > 128 || /\s/.test(row.slug)) {
      return `row ${i} has invalid slug: ${row.slug}`;
    }
    if (!knownSlugs.has(row.slug)) {
      return `row ${i} slug ${row.slug} not found in snapshot protocols`;
    }
    if (seenSlugs.has(row.slug)) {
      return `row ${i} duplicate slug: ${row.slug}`;
    }
    seenSlugs.add(row.slug);

    if (typeof row.name !== 'string' || row.name.trim().length === 0) {
      return `row ${i} has empty name`;
    }
    if (typeof row.rank !== 'number' || !Number.isInteger(row.rank) || row.rank <= 0) {
      return `row ${i} has invalid rank: ${row.rank}`;
    }
    if (seenRanks.has(row.rank)) {
      return `row ${i} has duplicate rank: ${row.rank}`;
    }
    seenRanks.add(row.rank);

    if (typeof row.implied_value_usd !== 'number' || !Number.isInteger(row.implied_value_usd) || row.implied_value_usd <= 0) {
      return `row ${i} has invalid implied_value_usd: ${row.implied_value_usd}`;
    }
    if (row.implied_value_usd > 100_000_000_000_000) {
      return `row ${i} implied_value_usd exceeds maximum limit`;
    }

    if (firstValue === null) firstValue = row.implied_value_usd;
    else if (row.implied_value_usd !== firstValue) allSame = false;

    if (row.implied_value_usd > prevValue) {
      return `row ${i} value ${row.implied_value_usd} is greater than previous ${prevValue} (not descending)`;
    }
    prevValue = row.implied_value_usd;

    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `row ${i} farm_steps count (${row.farm_steps?.length}) outside range [3, 12]`;
    }
    for (let s = 0; s < row.farm_steps.length; s++) {
      const step = row.farm_steps[s];
      if (typeof step !== 'string') return `row ${i} step ${s} is not a string`;
      const trimmed = step.trim();
      if (trimmed.length < 20 || trimmed.length > 600) {
        return `row ${i} step ${s} length ${trimmed.length} outside range [20, 600]`;
      }
    }
  }

  if (allSame && board.length > 1) {
    return 'all rows have identical implied_value_usd';
  }

  for (let r = 1; r <= board.length; r++) {
    if (!seenRanks.has(r)) {
      return `missing rank ${r}; ranks must be strictly 1 to N`;
    }
  }

  for (const slug of snapshot.watchlist) {
    if (!seenSlugs.has(slug)) {
      return `watchlist slug ${slug} not covered in board rows`;
    }
  }

  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR_DATA = ${JSON.stringify(radar)};\n`;
}
