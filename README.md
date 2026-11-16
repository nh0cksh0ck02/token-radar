# Token Launch Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/nh0cksh0ck02/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/nh0cksh0ck02/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Advanced token launch & airdrop valuation radar analyzing DefiLlama protocol snapshots to compute implied market capitalization, airdrop probabilities, and actionable farm plans.

## Overview

Token Launch Radar is a deterministic, offline-capable valuation engine and interactive analytics dashboard built for the `token-radar-01` challenge. It parses pre-token protocols tracked by DefiLlama and derives implied market valuations based on capital efficiency, sector economics, network dominance, momentum, and protocol maturity.

### Key Capabilities

1. **Comprehensive Universe Coverage**: Evaluates 100% of the sealed watchlist plus high-velocity emerging protocols below the floor threshold.
2. **Dynamic Valuation Modeling**:
   - Sector-specific capital multipliers (Derivatives, Lending, Liquid Restaking, DEX, Cross-chain).
   - Chain dominance & liquidity tier weighting.
   - 7-day TVL momentum elasticity.
   - Protocol operational maturity & points campaign accumulation curve.
3. **Actionable Farm Blueprints**: Every evaluated protocol includes a comprehensive 6-step farming strategy detailing initial wallet hygiene, minimum capital allocation, interaction cadences, gas overheads, and security checklists.
4. **Zero-Network Static Dashboard**: Built strictly adhering to the zero-network constraint with pure vanilla JS/CSS, sub-millisecond sorting, responsive multi-factor filtering, and an integrated protocol inspection modal.

## Architecture

- `main.ts`: CLI entrypoint (Node 22) executing snapshot parsing, model computation, board generation, and gate validation.
- `lib/model.ts`: Valuation heuristics, mathematical multipliers, step synthesizers, and gate verification logic.
- `dashboard/`:
  - `index.html`: Semantic, accessible structure without external network calls.
  - `app.css`: Dark-mode fintech / cyberpunk aesthetic with clean hierarchy and CSS variables.
  - `app.js`: High-performance UI engine handling search, sorting, category/chain/tier filtering, and modal analytics.
- `vendor/makefun-board.ts`: Canonical dossier builder and verification harness.

## Running Locally

Execute with Node 22+:

```bash
node main.ts --input path/to/snapshot.json --output out
```

Inspect output artifacts:
- `out/board.json`: Canonical ranked rows with valuations and farming steps.
- `out/data.js`: Serialized payload consumed by the dashboard.
- `out/dossier.json`: Judge verification dossier and media payload.
- `out/dashboard/`: Self-contained offline web application.

## License

MIT License.
