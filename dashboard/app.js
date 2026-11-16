// Token Radar Dashboard Application
// 100% Offline, Zero external dependencies

(function () {
  'use strict';

  var state = {
    radarData: null,
    filteredRows: [],
    selectedRow: null,
    searchQuery: '',
    selectedTier: 'all',
    selectedCategory: 'all',
    selectedChain: 'all',
    sortBy: 'rank',
    sortOrder: 'asc',
    checkedSteps: {},
  };

  function init() {
    if (typeof window !== 'undefined' && window.RADAR_DATA) {
      state.radarData = window.RADAR_DATA;
    } else {
      console.warn('RADAR_DATA not found on window object.');
      return;
    }

    renderSummaryMetrics();
    populateFilterOptions();
    applyFilters();
    bindEvents();
  }

  function formatUsd(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0';
    var num = Number(amount);
    if (num >= 1e12) {
      return '$' + (num / 1e12).toFixed(2) + 'T';
    }
    if (num >= 1e9) {
      return '$' + (num / 1e9).toFixed(2) + 'B';
    }
    if (num >= 1e6) {
      return '$' + (num / 1e6).toFixed(2) + 'M';
    }
    if (num >= 1e3) {
      return '$' + (num / 1e3).toFixed(1) + 'K';
    }
    return '$' + Math.round(num).toLocaleString();
  }

  function formatPercent(val) {
    if (val === null || val === undefined || isNaN(val)) return '0.0%';
    var sign = val > 0 ? '+' : '';
    return sign + Number(val).toFixed(1) + '%';
  }

  function renderSummaryMetrics() {
    var data = state.radarData;
    if (!data) return;

    var elTotal = document.getElementById('metric-total');
    var elWatchlist = document.getElementById('metric-watchlist');
    var elFdv = document.getElementById('metric-fdv');
    var elApex = document.getElementById('metric-apex');

    if (elTotal) elTotal.textContent = data.scored_count || data.rows.length;
    if (elWatchlist) elWatchlist.textContent = data.watchlist_count + ' / ' + data.watchlist_count;
    if (elFdv) elFdv.textContent = formatUsd(data.total_implied_value_usd);
    if (elApex) {
      var apexCount = data.rows.filter(function (r) { return r.tier === 'Apex'; }).length;
      elApex.textContent = apexCount;
    }
  }

  function populateFilterOptions() {
    var data = state.radarData;
    if (!data) return;

    var categories = {};
    var chains = {};

    data.rows.forEach(function (r) {
      if (r.category) categories[r.category] = true;
      if (Array.isArray(r.chains)) {
        r.chains.forEach(function (c) { chains[c] = true; });
      }
    });

    var catSelect = document.getElementById('filter-category');
    if (catSelect) {
      Object.keys(categories).sort().forEach(function (cat) {
        var opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
      });
    }

    var chainSelect = document.getElementById('filter-chain');
    if (chainSelect) {
      Object.keys(chains).sort().forEach(function (ch) {
        var opt = document.createElement('option');
        opt.value = ch;
        opt.textContent = ch;
        chainSelect.appendChild(opt);
      });
    }
  }

  function applyFilters() {
    if (!state.radarData) return;

    var query = state.searchQuery.toLowerCase().trim();
    var tier = state.selectedTier;
    var cat = state.selectedCategory;
    var chain = state.selectedChain;

    var rows = state.radarData.rows.filter(function (r) {
      if (query) {
        var matchName = r.name.toLowerCase().indexOf(query) !== -1;
        var matchSlug = r.slug.toLowerCase().indexOf(query) !== -1;
        var matchCat = r.category && r.category.toLowerCase().indexOf(query) !== -1;
        if (!matchName && !matchSlug && !matchCat) return false;
      }
      if (tier !== 'all' && r.tier !== tier) return false;
      if (cat !== 'all' && r.category !== cat) return false;
      if (chain !== 'all') {
        if (!Array.isArray(r.chains) || r.chains.indexOf(chain) === -1) return false;
      }
      return true;
    });

    rows.sort(function (a, b) {
      var key = state.sortBy;
      var factor = state.sortOrder === 'asc' ? 1 : -1;
      if (key === 'rank') return (a.rank - b.rank) * factor;
      if (key === 'implied_value_usd') return (b.implied_value_usd - a.implied_value_usd) * factor;
      if (key === 'tvl_usd') return (b.tvl_usd - a.tvl_usd) * factor;
      if (key === 'change_7d') return ((b.change_7d || 0) - (a.change_7d || 0)) * factor;
      if (key === 'name') return a.name.localeCompare(b.name) * factor;
      return 0;
    });

    state.filteredRows = rows;
    renderTable();
    updateResultsCount();
  }

  function updateResultsCount() {
    var countEl = document.getElementById('results-count');
    if (countEl) {
      countEl.textContent = state.filteredRows.length + ' protocols found';
    }
  }

  function renderTable() {
    var tbody = document.getElementById('radar-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (state.filteredRows.length === 0) {
      var emptyTr = document.createElement('tr');
      emptyTr.className = 'empty-row';
      emptyTr.innerHTML = '<td colspan="8">No protocols match your active filters.</td>';
      tbody.appendChild(emptyTr);
      return;
    }

    state.filteredRows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.className = 'radar-row' + (state.selectedRow && state.selectedRow.slug === r.slug ? ' active' : '');
      tr.setAttribute('data-slug', r.slug);

      var changeClass = (r.change_7d || 0) >= 0 ? 'text-up' : 'text-down';
      var tierBadgeClass = 'badge-tier-' + (r.tier || 'early').toLowerCase();
      var watchlistBadge = r.on_watchlist ? '<span class="badge badge-watchlist">Watchlist</span>' : '';

      tr.innerHTML =
        '<td class="cell-rank">#' + r.rank + '</td>' +
        '<td class="cell-name">' +
          '<div class="name-box">' +
            '<span class="name-text">' + escapeHtml(r.name) + '</span>' +
            '<span class="slug-text">' + escapeHtml(r.slug) + '</span>' +
          '</div>' +
        '</td>' +
        '<td class="cell-tier">' +
          '<span class="badge ' + tierBadgeClass + '">' + r.tier + '</span> ' + watchlistBadge +
        '</td>' +
        '<td class="cell-category">' + escapeHtml(r.category || 'DeFi') + '</td>' +
        '<td class="cell-valuation highlight">' + formatUsd(r.implied_value_usd) + '</td>' +
        '<td class="cell-tvl">' + formatUsd(r.tvl_usd) + '</td>' +
        '<td class="cell-growth ' + changeClass + '">' + formatPercent(r.change_7d) + '</td>' +
        '<td class="cell-actions">' +
          '<button class="btn btn-sm btn-inspect" data-slug="' + r.slug + '">View Plan</button>' +
        '</td>';

      tr.addEventListener('click', function () {
        selectRow(r);
      });

      tbody.appendChild(tr);
    });
  }

  function selectRow(row) {
    state.selectedRow = row;
    renderDetailDrawer(row);

    var rows = document.querySelectorAll('.radar-row');
    rows.forEach(function (tr) {
      if (tr.getAttribute('data-slug') === row.slug) {
        tr.classList.add('active');
      } else {
        tr.classList.remove('active');
      }
    });
  }

  function renderDetailDrawer(row) {
    var drawer = document.getElementById('detail-drawer');
    if (!drawer) return;

    var drawerContent = document.getElementById('drawer-content');
    if (!drawerContent) return;

    drawer.classList.remove('hidden');
    drawer.classList.add('open');

    var primaryChains = Array.isArray(row.chains) ? row.chains.join(', ') : 'Ethereum';
    var stepsHtml = '';

    if (Array.isArray(row.farm_steps)) {
      row.farm_steps.forEach(function (step, idx) {
        var stepId = row.slug + '_step_' + idx;
        var isChecked = !!state.checkedSteps[stepId];
        stepsHtml +=
          '<div class="step-item ' + (isChecked ? 'completed' : '') + '">' +
            '<label class="step-label">' +
              '<input type="checkbox" class="step-check" data-id="' + stepId + '" ' + (isChecked ? 'checked' : '') + ' />' +
              '<span class="step-num">Step ' + (idx + 1) + '</span>' +
              '<span class="step-desc">' + escapeHtml(step) + '</span>' +
            '</label>' +
          '</div>';
      });
    }

    drawerContent.innerHTML =
      '<div class="drawer-header">' +
        '<div class="drawer-title-group">' +
          '<span class="badge badge-tier-' + (row.tier || 'early').toLowerCase() + '">' + row.tier + ' Tier</span>' +
          '<h2>' + escapeHtml(row.name) + '</h2>' +
          '<p class="slug-muted">Protocol ID: ' + escapeHtml(row.slug) + ' &bull; Chains: ' + escapeHtml(primaryChains) + '</p>' +
        '</div>' +
        '<button id="btn-close-drawer" class="btn-close" aria-label="Close">&times;</button>' +
      '</div>' +

      '<div class="drawer-body">' +
        '<div class="stat-grid">' +
          '<div class="stat-card">' +
            '<span class="stat-label">Implied Valuation</span>' +
            '<span class="stat-value highlight">' + formatUsd(row.implied_value_usd) + '</span>' +
          '</div>' +
          '<div class="stat-card">' +
            '<span class="stat-label">Reported TVL</span>' +
            '<span class="stat-value">' + formatUsd(row.tvl_usd) + '</span>' +
          '</div>' +
          '<div class="stat-card">' +
            '<span class="stat-label">7D Velocity</span>' +
            '<span class="stat-value ' + ((row.change_7d || 0) >= 0 ? 'text-up' : 'text-down') + '">' + formatPercent(row.change_7d) + '</span>' +
          '</div>' +
          '<div class="stat-card">' +
            '<span class="stat-label">FDV / TVL Ratio</span>' +
            '<span class="stat-value">' + (row.fdv_tvl_ratio || '2.5') + 'x</span>' +
          '</div>' +
        '</div>' +

        '<div class="plan-section">' +
          '<div class="plan-header">' +
            '<h3>Actionable Farming Blueprint</h3>' +
            '<span class="plan-subtitle">Complete concrete steps to maximize token generation event weighting</span>' +
          '</div>' +
          '<div class="steps-container">' + stepsHtml + '</div>' +
        '</div>' +

        '<div class="risk-section">' +
          '<h4>Protocol Risk Profile & Allocation Target</h4>' +
          '<p>Suggested capital commitment: <strong>$' + (row.tvl_usd > 50e6 ? '1,000 - $5,000' : '$250 - $1,000') + '</strong> across 30+ day holding duration.</p>' +
          '<p>Risk assessment rating: <strong>' + (row.risk_level || 'Medium') + '</strong> based on on-chain liquidity depth and operational tenure.</p>' +
        '</div>' +
      '</div>';

    var closeBtn = document.getElementById('btn-close-drawer');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeDrawer();
      });
    }

    var checkBoxes = drawerContent.querySelectorAll('.step-check');
    checkBoxes.forEach(function (cb) {
      cb.addEventListener('change', function (e) {
        var id = e.target.getAttribute('data-id');
        state.checkedSteps[id] = e.target.checked;
        var parent = e.target.closest('.step-item');
        if (parent) {
          if (e.target.checked) parent.classList.add('completed');
          else parent.classList.remove('completed');
        }
      });
    });
  }

  function closeDrawer() {
    var drawer = document.getElementById('detail-drawer');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.classList.add('hidden');
    }
    state.selectedRow = null;
    var rows = document.querySelectorAll('.radar-row');
    rows.forEach(function (tr) { tr.classList.remove('active'); });
  }

  function bindEvents() {
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.searchQuery = e.target.value;
        applyFilters();
      });
    }

    var tierTabs = document.querySelectorAll('.tier-tab');
    tierTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tierTabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        state.selectedTier = tab.getAttribute('data-tier') || 'all';
        applyFilters();
      });
    });

    var catSelect = document.getElementById('filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', function (e) {
        state.selectedCategory = e.target.value;
        applyFilters();
      });
    }

    var chainSelect = document.getElementById('filter-chain');
    if (chainSelect) {
      chainSelect.addEventListener('change', function (e) {
        state.selectedChain = e.target.value;
        applyFilters();
      });
    }

    var sortSelect = document.getElementById('sort-by');
    if (sortSelect) {
      sortSelect.addEventListener('change', function (e) {
        state.sortBy = e.target.value;
        applyFilters();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeDrawer();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
