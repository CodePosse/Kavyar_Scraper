let state = {
  data: [],
  filtered: [],
  sortKey: 'deadlineTs',
  sortDirection: 'asc'
};

function text(value) {
  return value == null ? '' : String(value);
}

function compareValues(a, b, key, direction) {
  const aValue = a[key];
  const bValue = b[key];

  const aNorm = Array.isArray(aValue) ? aValue.join(', ') : aValue;
  const bNorm = Array.isArray(bValue) ? bValue.join(', ') : bValue;

  let result = 0;
  if (typeof aNorm === 'number' || typeof bNorm === 'number') {
    result = (aNorm ?? Number.MAX_SAFE_INTEGER) - (bNorm ?? Number.MAX_SAFE_INTEGER);
  } else {
    result = text(aNorm).localeCompare(text(bNorm), undefined, { sensitivity: 'base' });
  }

  return direction === 'asc' ? result : -result;
}

function renderGenres(genres) {
  if (!Array.isArray(genres) || genres.length === 0) return '<span class="muted">—</span>';
  return genres.map((genre) => `<span class="badge">${genre}</span>`).join('');
}

function renderEmptyState(message) {
  const tbody = document.querySelector('#listings-table tbody');
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="10" class="empty-state">${message}</td>
    </tr>
  `;
  const countEl = document.getElementById('listing-count');
  if (countEl) countEl.textContent = '0';
}

function renderTable(rows) {
  const tbody = document.querySelector('#listings-table tbody');
  if (!tbody) return;

  if (!rows.length) {
    renderEmptyState('No listings match the current filters.');
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${text(row.ownerName) || '<span class="muted">—</span>'}</td>
      <td>${text(row.title) || '<span class="muted">—</span>'}</td>
      <td>${text(row.medium) || '<span class="muted">—</span>'}</td>
      <td>${renderGenres(row.genres || [])}</td>
      <td>${row.deadline ? new Date(row.deadline).toLocaleDateString() : '<span class="muted">—</span>'}</td>
      <td>${text(row.minImages) || '<span class="muted">—</span>'}</td>
      <td>${text(row.maxImages) || '<span class="muted">—</span>'}</td>
      <td>${row.exclusivity == null ? '<span class="muted">—</span>' : (row.exclusivity ? 'Required' : 'No')}</td>
      <td>${text(row.ownerInstagramFollowerCount) || '<span class="muted">—</span>'}</td>
      <td>${row.url ? `<a href="${row.url}" target="_blank" rel="noreferrer">Open listing</a>` : '<span class="muted">—</span>'}</td>
    </tr>
  `).join('');

  const countEl = document.getElementById('listing-count');
  if (countEl) countEl.textContent = String(rows.length);
}

function populateSelect(id, values) {
  const select = document.getElementById(id);
  if (!select) return;
  const existing = new Set([...select.options].map((opt) => opt.value));
  values.forEach((value) => {
    if (!value || existing.has(value)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });
}

function applyFilters() {
  const search = document.getElementById('search')?.value.trim().toLowerCase() || '';
  const genre = document.getElementById('genre-filter')?.value || '';
  const medium = document.getElementById('medium-filter')?.value || '';
  const exclusivity = document.getElementById('exclusivity-filter')?.value || '';

  let rows = state.data.filter((row) => {
    const haystack = [row.ownerName, row.title, row.medium, row.url, ...(row.genres || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (genre && !(row.genres || []).includes(genre)) return false;
    if (medium && row.medium !== medium) return false;
    if (exclusivity && String(row.exclusivity) !== exclusivity) return false;
    return true;
  });

  rows.sort((a, b) => compareValues(a, b, state.sortKey, state.sortDirection));
  state.filtered = rows;
  renderTable(rows);
}

function bindEvents() {
  document.getElementById('search')?.addEventListener('input', applyFilters);
  document.getElementById('genre-filter')?.addEventListener('change', applyFilters);
  document.getElementById('medium-filter')?.addEventListener('change', applyFilters);
  document.getElementById('exclusivity-filter')?.addEventListener('change', applyFilters);
  document.getElementById('sort-by')?.addEventListener('change', (event) => {
    const target = event.target;
    const [key, direction] = target.value.split(':');
    state.sortKey = key;
    state.sortDirection = direction;
    applyFilters();
  });
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    document.getElementById('search').value = '';
    document.getElementById('genre-filter').value = '';
    document.getElementById('medium-filter').value = '';
    document.getElementById('exclusivity-filter').value = '';
    document.getElementById('sort-by').value = 'deadlineTs:asc';
    state.sortKey = 'deadlineTs';
    state.sortDirection = 'asc';
    applyFilters();
  });
  document.querySelectorAll('#listings-table th[data-key]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (!key) return;
      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDirection = 'asc';
      }
      const sortEl = document.getElementById('sort-by');
      if (sortEl) sortEl.value = `${state.sortKey}:${state.sortDirection}`;
      applyFilters();
    });
  });
}

function getEmbeddedData() {
  const script = document.getElementById('kavyar-data');
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || '{}');
  } catch (error) {
    console.error('Failed to parse embedded data', error);
    return null;
  }
}

async function getPayload() {
  const embedded = getEmbeddedData();
  if (embedded && Array.isArray(embedded.listings)) return embedded;

  const response = await fetch('./data.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load data.json (${response.status})`);
  return await response.json();
}

async function init() {
  const payload = await getPayload();
  state.data = Array.isArray(payload.listings) ? payload.listings : [];

  populateSelect('genre-filter', [...new Set(state.data.flatMap((item) => item.genres || []))].sort());
  populateSelect('medium-filter', [...new Set(state.data.map((item) => item.medium).filter(Boolean))].sort());
  bindEvents();

  if (!state.data.length) {
    renderEmptyState('No listings were embedded or loaded. Run the scraper/build again, or confirm the source data is not empty.');
    return;
  }

  applyFilters();
}

init().catch((error) => {
  console.error(error);
  renderEmptyState('Failed to load listing data. This page now supports embedded data, so rebuild the site and re-upload dist/.');
});
