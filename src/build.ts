import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { DATA_DIR, DIST_DIR, GET_PUBLISHED_URL } from './config.js';
import type { Listing, ScrapeOutput } from './types.js';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

async function ensureData(): Promise<ScrapeOutput> {
  const raw = await fs.readFile(path.join(DATA_DIR, 'listings.json'), 'utf8');
  return JSON.parse(raw) as ScrapeOutput;
}

function htmlShell(listingCount: number, generatedAt: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kavyar Submission Listings</title>
  <meta name="description" content="Sortable and filterable static directory of Kavyar submission listings.">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <div class="container">
    <header class="page-header">
      <div>
        <h1>Kavyar Submission Listings</h1>
        <p class="subhead">Static HTML output with client-side sorting and filtering.</p>
      </div>
      <div class="meta-card">
        <div><strong>Listings:</strong> <span id="listing-count">${listingCount}</span></div>
        <div><strong>Generated:</strong> ${new Date(generatedAt).toLocaleString()}</div>
        <div><strong>Source:</strong> <a href="${GET_PUBLISHED_URL}" target="_blank" rel="noreferrer">get-published</a></div>
      </div>
    </header>

    <section class="controls">
      <label>
        <span>Search</span>
        <input id="search" type="search" placeholder="Search title, owner, genre, URL...">
      </label>
      <label>
        <span>Genre</span>
        <select id="genre-filter"><option value="">All</option></select>
      </label>
      <label>
        <span>Medium</span>
        <select id="medium-filter"><option value="">All</option></select>
      </label>
      <label>
        <span>Exclusivity</span>
        <select id="exclusivity-filter">
          <option value="">All</option>
          <option value="true">Required</option>
          <option value="false">Not required</option>
        </select>
      </label>
      <label>
        <span>Sort by</span>
        <select id="sort-by">
          <option value="deadlineTs:asc">Deadline ↑</option>
          <option value="deadlineTs:desc">Deadline ↓</option>
          <option value="ownerInstagramFollowerCount:desc">Followers ↓</option>
          <option value="ownerName:asc">Owner A–Z</option>
          <option value="title:asc">Title A–Z</option>
        </select>
      </label>
      <button id="reset-btn" type="button">Reset</button>
    </section>

    <section class="table-wrap">
      <table id="listings-table">
        <thead>
          <tr>
            <th data-key="ownerName">Owner</th>
            <th data-key="title">Title</th>
            <th data-key="medium">Medium</th>
            <th data-key="genres">Genres</th>
            <th data-key="deadlineTs">Deadline</th>
            <th data-key="minImages">Min</th>
            <th data-key="maxImages">Max</th>
            <th data-key="exclusivity">Exclusivity</th>
            <th data-key="ownerInstagramFollowerCount">Followers</th>
            <th data-key="url">URL</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>
  </div>
  <script src="./app.js"></script>
</body>
</html>`;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function buildCsv(listings: Listing[]): Promise<void> {
  const headers = ['Owner Name', 'Title', 'Medium', 'Genres', 'Deadline', 'Min Images', 'Max Images', 'Exclusivity', 'Owner Instagram', 'Owner Instagram Follower Count', 'URL'];
  const rows = listings.map((item) => [
    item.ownerName,
    item.title,
    item.medium,
    item.genres.join(', '),
    formatDate(item.deadline),
    item.minImages,
    item.maxImages,
    item.exclusivity,
    item.ownerInstagram,
    item.ownerInstagramFollowerCount,
    item.url
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  await fs.writeFile(path.join(DIST_DIR, 'kavyar_listings.csv'), csv, 'utf8');
}

async function buildXlsx(listings: Listing[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.columns = [
    { header: 'Owner Name', key: 'ownerName', width: 25 },
    { header: 'Title', key: 'title', width: 35 },
    { header: 'Medium', key: 'medium', width: 14 },
    { header: 'Genres', key: 'genres', width: 22 },
    { header: 'Deadline', key: 'deadline', width: 18 },
    { header: 'Min Images', key: 'minImages', width: 12 },
    { header: 'Max Images', key: 'maxImages', width: 12 },
    { header: 'Exclusivity', key: 'exclusivity', width: 12 },
    { header: 'Owner Instagram', key: 'ownerInstagram', width: 35 },
    { header: 'Owner Instagram Follower Count', key: 'followers', width: 18 },
    { header: 'URL', key: 'url', width: 50 }
  ];

  for (const item of listings) {
    sheet.addRow({
      ownerName: item.ownerName,
      title: item.title,
      medium: item.medium,
      genres: item.genres.join(', '),
      deadline: formatDate(item.deadline),
      minImages: item.minImages,
      maxImages: item.maxImages,
      exclusivity: item.exclusivity,
      ownerInstagram: item.ownerInstagram,
      followers: item.ownerInstagramFollowerCount,
      url: item.url
    });
  }

  await workbook.xlsx.writeFile(path.join(DIST_DIR, 'kavyar_listings.xlsx'));
}

async function main(): Promise<void> {
  await fs.mkdir(DIST_DIR, { recursive: true });
  const data = await ensureData();

  const indexHtml = htmlShell(data.listingCount, data.generatedAt);
  await fs.writeFile(path.join(DIST_DIR, 'index.html'), indexHtml, 'utf8');
  await fs.copyFile(path.join('templates', 'style.css'), path.join(DIST_DIR, 'style.css'));
  await fs.copyFile(path.join('templates', 'app.js'), path.join(DIST_DIR, 'app.js'));
  await fs.writeFile(path.join(DIST_DIR, 'data.json'), JSON.stringify(data, null, 2), 'utf8');
  await buildCsv(data.listings);
  await buildXlsx(data.listings);

  console.log(`Built static site in ${DIST_DIR}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
