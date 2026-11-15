# Competition Radar

A responsive, source-backed dashboard for hackathons, developer challenges,
student innovation, open-source programs and startup competitions.

## Run locally

Requires Node.js 20 or newer. No third-party dependencies are needed.

```sh
npm start
```

Open http://localhost:4173. The server serves the dashboard and its live
feed endpoint. Run `npm test` to test listing normalization and failure handling.
Use `npm run build` to produce the Worker bundle in `dist/server/index.js`.

## Features

- Multi-filter search, relevance and deadline sorting
- Saved opportunities and application pipeline
- Sri Lanka timezone deadline calendar and ICS export
- Individual application checklists, status and notes
- Side-by-side comparison of up to four opportunities
- Live Devpost fetch with duplicate prevention and source status
- Daily review, reload, and JSON import/export for curated updates

The source catalog is `dist/opportunities.json`. Each record has a stable ID,
organizer link, rules link, deadline (with timezone when known), eligibility
label, technical themes and application checklist. Keep unknown facts marked
unverified and do not use watchlist entries as confirmed open competitions.

Saved opportunities, compared items and application progress are stored locally
in the browser.

Fetch Now calls `GET /api/fetch`, retrieves up to two pages of open online
Devpost listings, ranks relevant themes, and merges new listings without
replacing curated records. Listing times, individual eligibility, and prizes
must be confirmed against linked rules. Source failures leave the current
catalog unchanged. Other sources remain manual watchlists; no scheduled scan
is configured.
