# Kavyar Static Site Starter

This project scrapes public Kavyar `get-published` pages, normalizes listing data, and generates a static site with sortable and filterable tables.

## Output

Running the full pipeline writes these files into `dist/`:

- `index.html`
- `style.css`
- `app.js`
- `data.json`
- `kavyar_listings.csv`
- `kavyar_listings.xlsx`

## Install

```bash
npm install
```

## Run the full pipeline

```bash
npm run all
```

## Run only the scraper

```bash
npm run scrape
```

This writes `data/listings.json`.

## Build the static site from existing data

```bash
npm run build
```

## Preview locally

```bash
npm run start
```

Then open `http://localhost:8080`.

You can also open `dist/index.html` directly from disk now because the build embeds the listing data into the HTML as a fallback.

## Notes

- The scraper currently targets public `get-published/<genre>` pages and linked `/submissions/` pages.
- Because Kavyar can change markup at any time, you may need to tune selectors inside `src/scrape.ts`.
- The static page supports search, filters, and clickable column sorting in plain JavaScript.
- You can upload the generated `dist/` folder to almost any static host or your own Linux server.

## Main files

- `src/scrape.ts` – pulls public listings from Kavyar
- `src/build.ts` – generates static HTML, JSON, CSV, and XLSX
- `templates/app.js` – client-side table sorting and filtering
- `templates/style.css` – styles for the static page


## Important build change

- `index.html` now embeds the full dataset in a `<script type="application/json">` block.
- `app.js` uses embedded data first, then falls back to `data.json` when served over HTTP.
- If the dataset is empty, the page shows a visible empty-state message instead of a blank table.
