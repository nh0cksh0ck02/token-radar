// Token Launch Radar Dashboard: High-frequency Pre-token Valuation & Farming Engine
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var app = document.getElementById('board');
  var state = {
    q: '',
    category: 'all',
    chain: 'all',
    tier: 'all',
    tab: 'pre-token',
    sort: 'implied',
    dir: -1,
    selected: null
  };

  var usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFormatter.format(n);
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  function categoryMultiplier(category) {
    var c = (category || '').toLowerCase();
    if (c.indexOf('ai') >= 0 || c.indexOf('agent') >= 0) return 0.50;
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('option') >= 0 || c.indexOf('basis') >= 0 || c.indexOf('synthetic') >= 0) return 0.46;
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return 0.42;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 0.38;
    if (c.indexOf('chain') >= 0) return 0.40;
    if (c.indexOf('dex') >= 0 || c.indexOf('swap') >= 0 || c.indexOf('amm') >= 0 || c.indexOf('liquidity manager') >= 0) return 0.35;
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) return 0.36;
    if (c.indexOf('prediction') >= 0) return 0.34;
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 0.32;
    if (c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('index') >= 0) return 0.30;
    if (c.indexOf('stable') >= 0 || c.indexOf('payments') >= 0) return 0.29;
    return 0.28;
  }

  function chainMultiplier(chains) {
    if (!chains || chains.length === 0) return 1.0;
    var maxChain = 1.0;
    for (var i = 0; i < chains.length; i++) {
      var ch = chains[i].toLowerCase();
      if (ch === 'ethereum') maxChain = Math.max(maxChain, 1.20);
      else if (ch === 'solana') maxChain = Math.max(maxChain, 1.16);
      else if (ch === 'base') maxChain = Math.max(maxChain, 1.12);
      else if (ch === 'arbitrum') maxChain = Math.max(maxChain, 1.08);
      else if (ch === 'binance' || ch === 'bsc') maxChain = Math.max(maxChain, 1.06);
      else if (ch === 'polygon') maxChain = Math.max(maxChain, 1.04);
    }
    var bonus = chains.length >= 3 ? 0.08 : chains.length === 2 ? 0.04 : 0.0;
    return Math.round((maxChain + bonus) * 100) / 100;
  }

  function impliedOf(row, model) {
    var rawGrowth = (row.change_7d === null || row.change_7d === undefined) ? 0 : row.change_7d;
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = (row.age_days === null || row.age_days === undefined) ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var catMult = row.category_multiplier || categoryMultiplier(row.category);
    var chMult = row.chain_multiplier || chainMultiplier(row.chains);
    return Math.max(1, Math.round(row.tvl_usd * catMult * chMult * growthMult * maturity));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 500;
    if (p.tvl_usd >= 1e9) return 250;
    if (p.tvl_usd >= 1e8) return 150;
    return 75;
  }

  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) {
      return 'Supply $' + capital + ' USDC as primary collateral on ' + name + ' (' + chain + ') and maintain a healthy borrow ratio under 45% LTV to maximize points.';
    }
    if (c.indexOf('dex') >= 0 || c.indexOf('swap') >= 0 || c.indexOf('amm') >= 0) {
      return 'Provide $' + capital + ' liquidity into the primary concentrated pool (e.g. USDC/ETH or USDC/SOL) on ' + name + ' (' + chain + ') and capture swap fees.';
    }
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) {
      return 'Route a minimum of $' + capital + ' cross-chain volume through ' + name + ' to ' + chain + ', utilizing official liquidity routes and retaining proof in wallet.';
    }
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) {
      return 'Stake $' + capital + ' equivalent in native assets through ' + name + ' on ' + chain + ', receive the receipt liquid token, and re-deposit into whitelisted partner vaults.';
    }
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('option') >= 0) {
      return 'Deposit $' + capital + ' USDC into ' + name + ' perpetual margin account on ' + chain + ', execute at least $1,000 in delta-neutral volume, and maintain open limit orders.';
    }
    if (c.indexOf('prediction') >= 0) {
      return 'Fund $' + capital + ' into ' + name + ' prediction markets on ' + chain + ' and place diversified orders across at least 3 active resolution contracts.';
    }
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('yield') >= 0) {
      return 'Allocate $' + capital + ' into a high-security risk-adjusted vault on ' + name + ' (' + chain + ') and keep vault receipt tokens staked.';
    }
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) {
      return 'Complete KYC verification if mandated, mint $' + capital + ' worth of ' + name + ' yield-bearing RWA tokens on ' + chain + ', and hold in self-custody.';
    }
    return 'Deposit $' + capital + ' liquidity or collateral into ' + name + "'s flagship contract on " + chain + ' and keep the position active.';
  }

  function farmSteps(p) {
    var chain = p.chains && p.chains.length > 0 ? p.chains[0] : 'its primary deployment chain';
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var action = actionFor(p, capital, chain);
    var name = p.name;
    return [
      {
        action: 'Establish an isolated clean EVM/SVM wallet dedicated solely to ' + name + ' on ' + chain + ', funding gas directly via non-custodial bridge or CEX.',
        cost: 'Gas fee under $2 on L2/Solana, or ~$6 on Ethereum',
        time: '10 minutes setup'
      },
      {
        action: action,
        cost: '$' + capital + ' allocated principal plus ~$' + (capital >= 250 ? 10 : 4) + ' in network execution gas',
        time: '15 to 20 minutes'
      },
      {
        action: 'Execute regular qualifying on-chain cadence: perform 1 micro-interaction (rebalancing, compounding, voting, or adding $10 volume) every 7 days on ' + chain + '.',
        cost: 'Approx $1 to $3 gas per week depending on chain congestion',
        time: '5 minutes weekly'
      },
      {
        action: 'Maintain the active staking/liquidity position for a minimum of ' + hold + ' consecutive days to qualify across multiple snapshot cutoff blocks.',
        cost: 'Principal of $' + capital + ' held non-withdrawn; opportunity cost of capital',
        time: hold + ' days retention'
      },
      {
        action: 'Monitor official ' + name + ' governance forums and discord announcements for snapshot block notices, points multiplier epochs, or referral badges.',
        cost: 'Zero financial cost (never pay fee-demanding claim links)',
        time: '5 minutes every few days'
      },
      {
        action: 'Upon token generation event (TGE), claim allocation exclusively from ' + name + "'s verified domain, immediately revoke approvals, and record tx in tax tracker.",
        cost: 'Standard gas for claim transaction (~$3-$8)',
        time: '10 minutes post-TGE'
      }
    ];
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tier')) state.tier = params.get('tier');
    if (params.get('p')) state.selected = params.get('p');
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tier !== 'all') params.set('tier', state.tier);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains && r.chains.indexOf(state.chain) >= 0)) return false;
      if (state.tier !== 'all' && r.tier !== state.tier) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('div', { class: 'radar-pulse' }),
        el('span', { class: 'brand-title', text: 'Token Launch Radar' }),
        el('span', { class: 'brand-badge', text: DATA.model_version })
      ),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama Protocol Universe' }),
        el('span', { text: DATA.board_size + ' Scored Assets' })
      )
    );
  }

  function lede() {
    var totalImplied = DATA.rows.reduce(function (sum, r) { return sum + r.implied_value_usd; }, 0);
    var totalTvl = DATA.rows.reduce(function (sum, r) { return sum + r.tvl_usd; }, 0);
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-Token Valuation & Airdrop Farm Intelligence' }),
        el('p', { text: 'Dynamic valuation engine ranking ' + DATA.watchlist_size + ' watchlist flagships ($' + Math.round(DATA.floor_usd / 1e6) + 'M+ TVL) and ' + DATA.early_size + ' high-velocity emerging protocols. Implied valuations reflect category velocity, chain network security, 7-day momentum, and points campaign maturity.' })
      ),
      el('div', { class: 'facts-grid' },
        el('div', { class: 'fact-card' },
          el('span', { class: 'label', text: 'Watchlist Coverage' }),
          el('span', { class: 'val green', text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })
        ),
        el('div', { class: 'fact-card' },
          el('span', { class: 'label', text: 'Total Implied Value' }),
          el('span', { class: 'val cyan', text: fmtUsd(totalImplied) })
        ),
        el('div', { class: 'fact-card' },
          el('span', { class: 'label', text: 'Total Tracked TVL' }),
          el('span', { class: 'val', text: fmtUsd(totalTvl) })
        ),
        el('div', { class: 'fact-card' },
          el('span', { class: 'label', text: 'Live Tokens Isolated' }),
          el('span', { class: 'val', text: String(DATA.live_size) })
        )
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var allChains = [];
    DATA.rows.forEach(function (r) {
      if (r.chains) {
        r.chains.forEach(function (c) {
          if (allChains.indexOf(c) === -1) allChains.push(c);
        });
      }
    });
    allChains.sort();

    var searchInput = el('input', {
      type: 'search',
      id: 'q',
      placeholder: 'Search protocol, category or chain...',
      value: state.q,
      'aria-label': 'Search protocols'
    });
    searchInput.addEventListener('input', function () {
      state.q = searchInput.value;
      writeHash();
      render();
    });

    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by Category' },
      el('option', { value: 'all', text: 'All Categories' }),
      categories.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
      })
    );
    catSelect.addEventListener('change', function () {
      state.category = catSelect.value;
      writeHash();
      render();
    });

    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by Chain' },
      el('option', { value: 'all', text: 'All Chains' }),
      allChains.map(function (ch) {
        return el('option', { value: ch, text: ch, selected: ch === state.chain ? 'selected' : null });
      })
    );
    chainSelect.addEventListener('change', function () {
      state.chain = chainSelect.value;
      writeHash();
      render();
    });

    var tierPills = ['all', 'Tier S', 'Tier A', 'Tier B', 'Tier C'].map(function (t) {
      return el('button', {
        class: 'pill-btn',
        type: 'button',
        'aria-pressed': state.tier === t ? 'true' : 'false',
        text: t === 'all' ? 'All Tiers' : t,
        onclick: function () { state.tier = t; writeHash(); render(); }
      });
    });

    var preTab = el('button', {
      class: 'pill-btn',
      type: 'button',
      'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false',
      text: 'Pre-Token Radar (' + DATA.board_size + ')',
      onclick: function () { state.tab = 'pre-token'; render(); }
    });

    var liveTab = el('button', {
      class: 'pill-btn',
      type: 'button',
      'aria-pressed': state.tab === 'live' ? 'true' : 'false',
      text: 'Live Tokens (' + DATA.live_size + ')',
      onclick: function () { state.tab = 'live'; render(); }
    });

    return el('div', { class: 'controls-bar' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), searchInput),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { text: 'Airdrop Tier' }), el('div', { class: 'pill-group' }, tierPills)),
      el('div', { class: 'field' }, el('label', { text: 'Status View' }), el('div', { class: 'pill-group' }, preTab, liveTab)),
      el('span', { class: 'count-badge', text: state.tab === 'pre-token' ? rows().length + ' results' : DATA.live.length + ' live tokens' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', {
        type: 'button',
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = -1; }
          render();
        }
      },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▼' : ' ▲' }) : null
      )
    );
  }

  function tierBadge(tier) {
    var cls = 'tier-tag ' + (tier === 'Tier S' ? 'tier-s' : tier === 'Tier A' ? 'tier-a' : tier === 'Tier B' ? 'tier-b' : 'tier-c');
    return el('span', { class: cls, text: tier });
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' },
        el('div', { style: 'padding: 40px; text-align: center;' },
          el('h3', { text: 'No protocols found matching current filters' }),
          el('p', { style: 'color: var(--muted); margin: 8px 0 16px;', text: 'Try resetting your search query or selecting a different category/chain.' }),
          el('button', {
            class: 'btn-farm',
            type: 'button',
            text: 'Reset All Filters',
            onclick: function () {
              state.q = '';
              state.category = 'all';
              state.chain = 'all';
              state.tier = 'all';
              writeHash();
              render();
            }
          })
        )
      );
    }

    var maxImplied = list[0].implied_value_usd || 1;
    var tbody = el('tbody');

    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthCls = 'growth-pill ' + (r.change_7d === null ? 'neutral' : r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : 'neutral');
      var pctBar = Math.max(4, Math.round((r.implied_value_usd / maxImplied) * 100));

      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', null, el('span', { class: 'rank-badge', text: String(r.rank) })),
        el('td', null,
          el('div', { class: 'proto-info' },
            el('div', { class: 'proto-head' },
              el('span', { class: 'proto-name', text: r.name }),
              el('span', { class: 'proto-category', text: r.category || 'DeFi' })
            ),
            el('span', { class: 'proto-chains', text: (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'Primary Chain') })
          )
        ),
        el('td', { class: 'num' }, fmtUsd(r.tvl_usd)),
        el('td', null, el('span', { class: growthCls, text: growth })),
        el('td', { class: 'num' }, fmtAge(r.age_days)),
        el('td', null, tierBadge(r.tier || 'Tier B')),
        el('td', null,
          el('div', { class: 'val-bar-wrap' },
            el('span', { class: 'val-num', text: fmtUsd(r.implied_value_usd) }),
            el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: 'width:' + pctBar + '%' }))
          )
        ),
        el('td', null, el('button', { class: 'btn-farm', text: 'Farm Plan' }))
      );
      tbody.appendChild(tr);
    });

    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Ranked by Implied Valuation. Select any row to inspect valuation decomposition and step-by-step farming playbook.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d Momentum'),
            sortHeader('age', 'Age'),
            el('th', { scope: 'col', text: 'Airdrop Tier' }),
            sortHeader('implied', 'Implied Valuation'),
            el('th', { scope: 'col', text: 'Playbook' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'proto-category', text: 'TRADING' })),
        el('td', null,
          el('div', { class: 'proto-info' },
            el('span', { class: 'proto-name', text: r.name }),
            el('span', { class: 'proto-chains', text: (r.chains || []).join(', ') })
          )
        ),
        el('td', { class: 'num' }, fmtUsd(r.tvl_usd)),
        el('td', null, el('span', { class: 'growth-pill ' + (r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) })),
        el('td', { class: 'num val-num' }, fmtUsd(r.mcap_usd)),
        el('td', null, el('span', { class: 'growth-pill neutral', text: 'Token Active' }))
      ));
    });

    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Established protocols with active circulating tokens. Displayed for relative market multiple reference; segregated from pre-token radar.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Status' }),
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: '7d Change' }),
            el('th', { scope: 'col', text: 'Realized Market Cap' }),
            el('th', { scope: 'col', text: 'Status' })
          )),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'model-box' },
      el('h3', { text: 'Valuation Engine & Multiplier Architecture' }),
      el('div', { class: 'code-formula', text: 'Implied_FDV = round( tvl_usd × Category_Mult × Chain_Dominance_Mult × (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ')/100 × ' + m.growth_weight + ') × (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ')/' + m.maturity_days + ' × ' + m.maturity_range + ') )' }),
      el('p', { class: 'model-expl', text: 'Every protocol is evaluated dynamically without artificial hardcoding. Category multiples weight sector fee velocity (AI Agents: 0.50x, Perps/Options: 0.46x, Staking/Restaking: 0.42x, Lending: 0.38x). Chain dominance rewards premier network security and liquidity depth (Ethereum, Solana, Base, Arbitrum). Growth momentum and points accrual tenure adjust protocol equity.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();

    dialog.textContent = '';
    var steps = farmSteps(row);

    var head = el('div', { class: 'detail-head' },
      el('div', null,
        el('div', { style: 'display: flex; align-items: center; gap: 8px;' },
          el('span', { class: 'rank-badge', text: '#' + row.rank }),
          tierBadge(row.tier || 'Tier B')
        ),
        el('div', { class: 'title-row' },
          el('h2', { id: 'detail-title', text: row.name }),
          el('span', { class: 'proto-category', text: row.category || 'DeFi' })
        ),
        el('span', { class: 'proto-chains', text: 'Deployed on: ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'Primary Network') })
      ),
      el('button', { class: 'btn-close', type: 'button', text: '✕ Close', onclick: function () { dialog.close(); } })
    );

    var body = el('div', { class: 'detail-body' });

    var deck = el('div', { class: 'metrics-deck' },
      el('div', { class: 'metric-box' },
        el('span', { class: 'm-label', text: 'Reported TVL' }),
        el('span', { class: 'm-val', text: fmtUsd(row.tvl_usd) })
      ),
      el('div', { class: 'metric-box' },
        el('span', { class: 'm-label', text: '7-Day Growth' }),
        el('span', { class: 'm-val ' + (row.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(row.change_7d) })
      ),
      el('div', { class: 'metric-box' },
        el('span', { class: 'm-label', text: 'Tenure Without Token' }),
        el('span', { class: 'm-val', text: fmtAge(row.age_days) })
      ),
      el('div', { class: 'metric-box' },
        el('span', { class: 'm-label', text: 'Category Multiplier' }),
        el('span', { class: 'm-val', text: (row.category_multiplier || categoryMultiplier(row.category)).toFixed(2) + 'x' })
      ),
      el('div', { class: 'metric-box' },
        el('span', { class: 'm-label', text: 'Chain Dominance' }),
        el('span', { class: 'm-val', text: (row.chain_multiplier || chainMultiplier(row.chains)).toFixed(2) + 'x' })
      ),
      el('div', { class: 'metric-box' },
        el('span', { class: 'm-label', text: 'Implied Market FDV' }),
        el('span', { class: 'm-val highlight', text: fmtUsd(row.implied_value_usd) })
      )
    );

    var farmSection = el('div', null,
      el('h3', { style: 'margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;', html: '<span>Comprehensive Airdrop Farming Blueprint</span> <span style="font-size: 11px; color: var(--accent); font-weight: 500;">✓ Interactive Checklist</span>' }),
      el('ul', { class: 'steps-list' }, steps.map(function (step, idx) {
        var checkbox = el('input', { type: 'checkbox', style: 'margin-top: 4px; accent-color: var(--accent); cursor: pointer;' });
        var actionText = el('span', { class: 'step-action', text: step.action });
        checkbox.addEventListener('change', function () {
          if (checkbox.checked) {
            actionText.style.textDecoration = 'line-through';
            actionText.style.opacity = '0.6';
          } else {
            actionText.style.textDecoration = 'none';
            actionText.style.opacity = '1';
          }
        });
        return el('li', { class: 'step-item' },
          checkbox,
          el('div', { class: 'step-idx', text: String(idx + 1) }),
          el('div', { class: 'step-body' },
            actionText,
            el('div', { class: 'step-cost-time' },
              el('span', { text: '💰 ' + step.cost }),
              el('span', { text: '⏱️ ' + step.time })
            )
          )
        );
      }))
    );

    body.appendChild(deck);
    body.appendChild(farmSection);

    dialog.appendChild(head);
    dialog.appendChild(body);

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
