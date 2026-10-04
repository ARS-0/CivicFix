# CivicFix

**Snap a photo of a local problem. AI sorts it, merges duplicates, and routes it to the right city team. Residents follow it until it is fixed.**

CivicFix is an AI-powered civic issue reporting platform: residents report potholes, broken streetlights, garbage, water leaks and road damage; vision AI categorises and scores each report; PostGIS groups nearby duplicates; and city admins manage everything from a live map dashboard.

## Features

| PRD requirement | Status |
|---|---|
| Camera / gallery photo upload, EXIF GPS extraction with geolocation + manual map fallback | Done |
| AI issue type, severity (1-10), public-zone detection, auto-written title and description | Done (Claude vision, or offline CLIP) |
| Interactive pin picker with drag-to-adjust | Done |
| Ticket pipeline Reported, Verified, Assigned, In Progress, Resolved with full history | Done |
| Real-time notifications (Socket.IO) + optional WhatsApp via Twilio | Done |
| Admin map with status-coloured markers and clusters | Done |
| AI priority score (severity, category risk, public-zone proximity, repeat reports) | Done |
| Duplicate detection: PostGIS `ST_DWithin` within 20 m, same category, 14 days, linked to a master ticket | Done |
| Duplicates follow the master ticket's status and all reporters are notified | Done |
| Heatmap, reports by category, avg. resolution time, 30-day trend, department performance | Done |
| JWT auth with roles, rate limiting, helmet, upload sanitising (re-encoded with sharp, EXIF stripped) | Done |

## Architecture

```
Next.js static export (served by Express) --REST + Socket.IO--> Express API --HTTP--> FastAPI AI service --> Claude vision / CLIP
                                                      |
                                              PostgreSQL + PostGIS
```

- `frontend/` Next.js 14 (App Router), Tailwind, Leaflet + markercluster + heat
- `backend/` Express, `pg`, JWT, Socket.IO, sharp, multer
- `ai-service/` FastAPI. Providers: Claude vision (`ANTHROPIC_API_KEY`), offline CLIP (`USE_CLIP=1`), or a safe fallback so reporting never blocks
- Schema is created automatically on backend start (`backend/src/schema.sql`), so any managed Postgres with PostGIS works

### Priority score (0-100)
`severity x 5` + category risk (water leak 20 ... other 5) + 15 if near a public area + 3 per duplicate report (max 5). Each new duplicate re-scores its master ticket.

## Deploy in one click (no config, no API keys)

1. Push this repo to GitHub.
2. Render dashboard, **New, Blueprint**, pick the repo, **Apply**. `render.yaml` creates the Postgres (PostGIS) database and the app.
3. When it is live (about 5 minutes), open the URL. Demo data is already loaded.

Admin login: `admin@civicfix.dev` / `Admin#12345`.

The app is one Docker image: Express serves the API, Socket.IO and the exported Next.js frontend from the same origin, so there are no URLs or CORS settings to set. Photos are stored in Postgres, so they survive restarts on free hosting.

**AI is optional.** With no key, users choose the category themselves. To switch on vision analysis, deploy `ai-service/` as a second service with `ANTHROPIC_API_KEY` (or `USE_CLIP=1` for a free offline model), then set `AI_SERVICE_URL` on the app.

## Run locally

```bash
docker compose up --build        # app on http://localhost:4000
```
Add `ANTHROPIC_API_KEY` to a `.env` file to enable AI. Or run without Docker: start Postgres with PostGIS, then `cd frontend && npm i && npm run build && cp -r out ../backend/public`, then `cd backend && npm i && DATABASE_URL=... JWT_SECRET=dev npm start`.

Optional env vars: `SEED_DEMO=false`, `DEMO_CENTER=lat,lng`, `NEXT_PUBLIC_DEFAULT_CENTER=lat,lng` (build time), `TWILIO_*` for WhatsApp.

## API summary

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/login` | JWT |
| POST | `/api/reports/analyze` | photo to AI draft, nothing saved |
| POST | `/api/reports` | create ticket, runs duplicate detection |
| GET | `/api/reports/public` | map data, no personal info |
| GET | `/api/reports` | mine (citizen) or full prioritised queue (admin) |
| PATCH | `/api/reports/:id/status` | admin; moves master + duplicates, notifies everyone |
| GET | `/api/analytics` | admin; heatmap, categories, resolution times |

## Known limits and next steps
- Photos are stored in Postgres (simple and persistent); move to S3/R2 at larger scale.
- Render's free database expires after 30 days; upgrade or re-create it for long-term use.
- AI fields (severity, confidence) come from the client after `/analyze`; a production version would sign that result server-side.
- iPhone HEIC photos are usually converted to JPEG by the browser; native HEIC decoding is not included.
