# Glide — Real-Time Ride-Hailing Platform (Phase 1 MVP)

A ride-hailing web app with a Passenger Portal and a Driver Portal. Passengers enter a pickup and destination, see a server-calculated fare, and are matched to the nearest eligible driver. Offers go to one driver at a time with a 30-second expiry and automatic fallback. Drivers accept, start and complete rides.

> **Demo project.** Drivers are **unverified**. There is no licence or vehicle verification, and the UI labels them "Unverified demo driver". Do not treat this as production-ready.

## Technology stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite, Tailwind CSS v4, React Router, Lucide icons, Fetch API |
| Backend | Node.js (ESM) + Express 5, REST, zod validation; routes / controllers / services / middleware |
| Database | Supabase: PostgreSQL, Auth, Row Level Security, Realtime |
| Maps | Google Maps JS API + Places (New) in the browser; Routes API on the server |

## Repository layout

```
frontend/   React app (pages/passenger, pages/driver, components, hooks, context, services, lib)
backend/    Express API (routes, controllers, services, matching, middleware, stores, config) + tests + demo seed script
supabase/   migrations/ (schema, dispatch SQL functions, RLS) and seed.sql
```

## How it works

- **Auth:** Supabase Auth handles signup/login. A database trigger creates the `profiles` row (and a `drivers` row for drivers) from signup metadata. The role is fixed at registration; a trigger blocks changes.
- **Fare:** `Base ₹40 + distance_km × ₹12 + minutes × ₹2`. The backend asks Google Routes for distance and duration, so client-submitted numbers are ignored. Duration rounds up to whole minutes and the fare to the nearest rupee. Rates are env-configurable.
- **Matching (all atomic SQL functions, called only by the backend):**
  1. `find_eligible_drivers`: online, fresh location (≤120 s), no active ride, no live pending offer, within 5 km (then 10 km), ranked by Haversine distance.
  2. `create_offer`: one pending offer per ride and per driver, enforced by partial unique indexes. Concurrent dispatches can't give a driver two offers.
  3. `accept_offer`: locks ride → offer → driver, then checks ownership, pending status, expiry, ride state, driver online and not busy, and assigns the ride in one transaction.
  4. A backend worker (every 2 s) expires lapsed offers and moves to the next driver, so expiry never depends on a browser. It also recovers rides stranded by a restart.
  5. No driver left → ride becomes `unmatched` and the passenger can retry.
- **Double-booking is blocked at the database level** by a unique index on `rides(driver_id)` for active statuses. Duplicate ride creation is blocked by an idempotency key plus one open ride per passenger.
- **Real-time:** the UI subscribes to Supabase Realtime for instant refetches, and always polls (2–5 s) as a fallback. A refresh or reconnect recovers state from the database.
- **Privacy:** phone numbers are released only by the backend, only to the other participant, and only while the ride is `accepted` or `in_progress`. Offers shown to drivers contain no passenger identity.
- **Extensibility:** ranking strategies are pluggable (`backend/src/matching/ranker.js`), routing sits behind `routeService`, and the data layer sits behind a store interface. Phase 2/3 features slot in without restructuring.

## Setup

### 1. Prerequisites
Node.js 20.6+ (developed on Node 26) and a Supabase project. A Google Maps project is needed for real location search and routing.

### 2. Supabase configuration
1. Create a project at <https://supabase.com>.
2. **Apply migrations**: open *SQL Editor* and run, in order, the files in `supabase/migrations/`:
   `20250101000001_schema.sql`, `20250101000002_dispatch_functions.sql`, `20250101000003_rls.sql`.
   (Or with the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Auth:** *Authentication → Providers → Email*. For the demo, turn **off** "Confirm email" so signups can log in immediately.
4. **Keys:** *Project Settings → API Keys*: copy the **Project URL**, the **publishable** key (`sb_publishable_…`) and the **secret** key (`sb_secret_…`). The secret key goes in the backend only.
5. **Realtime:** the RLS migration adds `rides` and `ride_offers` to the `supabase_realtime` publication. Check *Database → Publications* if updates seem slow (polling still works).

### 3. Google Maps configuration
Create a Google Cloud project with billing enabled, then enable **Maps JavaScript API**, **Places API (New)** and **Routes API**.
- **Browser key** (`VITE_GOOGLE_MAPS_BROWSER_KEY`): restrict by *HTTP referrers* (e.g. `http://localhost:5173/*` plus your deployed origin) and to *Maps JavaScript API* + *Places API (New)*.
- **Server key** (`GOOGLE_MAPS_SERVER_KEY`): restrict to *Routes API* only, plus an IP restriction when deployed.

Without a browser key the location boxes fall back to a few clearly labelled Bengaluru demo places. Without a server key, fare estimates return a clear "not configured" error. For offline development only, set `ROUTES_PROVIDER=mock` in the backend (straight-line ×1.3 at 25 km/h, flagged as a demo estimate in the UI).

### 4. Environment variables
```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```
Fill in the values:

| File | Variable | Purpose |
|---|---|---|
| backend | `PORT` | API port (3000) |
| backend | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | verify user tokens |
| backend | `SUPABASE_SECRET_KEY` | server-only data access (bypasses RLS; never in the frontend) |
| backend | `GOOGLE_MAPS_SERVER_KEY` | Routes API |
| backend | `FRONTEND_ORIGIN` | CORS origin (`http://localhost:5173`) |
| backend | optional | `BASE_FARE`, `PER_KM_RATE`, `PER_MINUTE_RATE`, `OFFER_TTL_SECONDS`, `INITIAL_RADIUS_KM`, `EXPANDED_RADIUS_KM`, `LOCATION_STALE_SECONDS`, `ROUTES_PROVIDER`, `DEMO_PASSWORD` |
| frontend | `VITE_API_BASE_URL` | backend URL (`http://localhost:3000`) |
| frontend | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase client |
| frontend | `VITE_GOOGLE_MAPS_BROWSER_KEY` | Places autocomplete |

### 5. Install and run
```powershell
cd backend;  npm install; npm run dev     # http://localhost:3000   (health: /health)
```
```powershell
cd frontend; npm install; npm run dev     # http://localhost:5173
```

## Running the demo (two browser windows)

Create demo data (development only; refuses to run when `NODE_ENV=production`):
```powershell
cd backend
npm run seed:demo -- --watch
```
This creates `passenger@demo.ridehail.test` and `driver1`–`driver3@demo.ridehail.test` (password `DemoPass#2025`, or `DEMO_PASSWORD`). The drivers are unverified, with placeholder phone numbers and vehicles, online around central Bengaluru. `--watch` re-stamps their locations every 30 s, because locations older than 2 minutes are treated as stale. Leave it running during the demo.

**Window 1: Passenger** (`passenger@demo.ridehail.test`)
1. Log in, open *Book a ride*.
2. Pick pickup *MG Road* and destination *Indiranagar* (or any Google suggestions).
3. Review the distance, time and fare breakdown, then click **Find Driver**.
4. Watch the matching progress, then the confirmed driver card with a call link.
5. Watch status through completion.

**Window 2: Driver** (an incognito window works well; `driver1@demo.ridehail.test`)
1. Log in, switch **Online**, and allow location when prompted. The demo drivers are seeded at fixed points, so your real location may move the driver away from the pickup. If so, deny the prompt or untick auto-refresh and use the seeded location, or choose a pickup near you.
2. The request card appears with a 30 s countdown. **Accept**.
3. **Start ride**, then **Complete ride**.

To see fallback, **Reject** or let the countdown run out on driver1, and the request moves to the next-nearest driver (driver2).

You can also sign up fresh accounts at `/signup`.

## Testing

```powershell
cd backend; npm test          # 55 tests
cd backend; npm run lint
cd frontend; npm run lint; npm run build
```
Backend tests cover fare maths, the Routes API client, Haversine and ranking, the ride state machine, and **real SQL** run on an in-process PostgreSQL (PGlite) with the project's actual migrations:

- radius expansion; offline, stale, missing-location and busy drivers excluded
- reject → next driver; expiry → next driver; expired offers cannot be accepted
- 5 simultaneous passengers with 2 drivers; two drivers racing for one ride
- DB-level double-booking constraint; going offline mid-offer
- RLS and grants; role immutability; state-transition trigger
- the HTTP layer: auth, role checks, unauthorized access to other users' rides, validation, Maps failure (502), database failure (503), repeated-click idempotency, contact privacy

### Edge cases and where they are covered
| Edge case | Verified by |
|---|---|
| No available drivers | `dispatch`, `api` tests |
| Driver rejects / offer expires | `dispatch`, `api` tests |
| Simultaneous passengers; two drivers accept the same ride | `dispatch` tests |
| Driver goes offline | `dispatch`, `api` tests |
| Invalid pickup/destination | `api` tests |
| Google Maps API failure | `unit`, `api` tests |
| Database connection failure | `api` test (503) |
| Unauthorized access to another user's ride | `api` tests (404/403) |
| Browser refresh during an active ride | Server side: `GET /api/me` and `/api/rides/active` recover state (`api` test). Not browser-tested. |

## Known limitations

- **Not verified against a live Supabase project or real Google keys.** I had no credentials. The SQL was run on PGlite (real Postgres, single connection). The PostgREST/RPC wrapper (`supabaseStore.js`), Supabase Auth token verification, Realtime and the Google calls have not been run end to end. Expect some small first-run fixes.
- PGlite serialises queries, so the concurrency tests prove logic, row locks and constraints, not true parallel transactions. The design relies on Postgres row locks and unique indexes for that.
- The frontend was only built, linted and loaded unauthenticated (landing/signup screens). The booking and driver flows were not driven in a browser.
- Place autocomplete uses the Places (New) client API and is untested against a real key.
- The dispatch worker runs inside the API process. It is safe with several instances, since all transitions are atomic SQL, but you would normally run it as its own worker.
- No rate limiting, no map display (optional in Phase 1), no driver verification, and no payments. Fares are estimates only.
- Driver location is a single foreground reading plus an optional 30 s refresh while the page is open; there is no background tracking.
- Matching uses straight-line distance as a proxy. It is not road distance or ETA.
- A driver cancelling an accepted ride cancels it (it is not re-dispatched).

## Roadmap

**Phase 2:** live GPS map tracking and driver movement, account overview and ride history, customer support, safety features, emergency contacts, trip sharing. The hooks are already in place: a store interface, the ranking strategy registry, `ride_offers` history, and `fare_breakdown` stored with each ride.

**Phase 3:** driver tips, add-on services, multiple stops, vehicle types and vehicle-based pricing, advanced route calculations (traffic-aware ETA ranking via Routes matrix, using `registerStrategy('eta', …)`).
