# Token Launch Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/nh0cksh0ck02/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/nh0cksh0ck02/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Advanced token launch radar analyzing DefiLlama snapshots to compute implied valuations and actionable airdrop farming plans.

## Overview

Token Launch Radar screens institutional snapshots from DefiLlama to identify high-conviction protocols that have not yet launched a native token. By combining on-chain liquidity depth (TVL), 7-day velocity metrics, protocol operational longevity, and category-weighted valuation multiples, the radar derives deterministic implied fully diluted valuations (FDV).

## Architecture

- **`main.ts`**: Pure Node 22 CLI engine reading snapshots, executing the valuation model, enforcing safety validation rules, and packaging dashboard artifacts with `buildDossier`.
- **`lib/model.ts`**: Valuation calculation engine, deterministic ranking algorithm, and protocol-specific 4-stage farming strategy generator.
- **`dashboard/`**: 100% offline, zero-network interactive user interface:
  - **Live Board View**: Sortable and filterable matrix of the top 200 pre-token protocols.
  - **Detail Drawer**: Interactive protocol dossier featuring concrete farming steps with capital and gas estimates.
  - **Multi-Filter Navigation**: Real-time filtering across Tiers (Apex, High, Mid, Early), Categories, and Ecosystem Chains.

## Verification

Run the pipeline against snapshot data:

```bash
node main.ts --input ../token-radar-01-kit/token-radar-01-kit/input/snapshot.json --output out
```
