# Current Implementation State — Suman Food

> **Last Updated:** 2026-10-26
> **Status:** Production-ready; full audit complete — **0 open bugs**, server/client compile clean, **92/92 backend tests passing**, local checkout verified against a single-node replica set with standalone fallback covered
> **Tracking:** This file is a living snapshot — update on every change

---

## ✅ Implemented Features

### Authentication & User
- [x] Signup (immediate activation, no email verification)
- [x] Login / Logout
- [x] JWT in HTTP-only cookies (secure + sameSite: none in prod)
- [x] Profile update (fullname, email, contact, alternateContact, address, pincode, city, **state**, country, avatar)
- [x] Check auth status (persists session)
- [x] Rate-limited auth endpoints (10 attempts / 15 min per IP)
- [ ] Forgot/Reset password — **removed** (files deleted; not exposed in UI/API)

### Customer Features
- [x] Restaurant search (debounced, real-time) + advanced filters
- [x] Cart (add/remove/update, persisted in Zustand)
- [x] **Single-restaurant cart enforcement** — restaurant derived from cart items; mixed carts blocked at checkout
- [x] Checkout: Stripe Checkout + Cash on Delivery (COD)
- [x] Server-side price verification (client prices never trusted) + `MIN_ORDER_AMOUNT`
- [x] Order history: Active vs Past tabs
- [x] Reorder from past order (one click)
- [x] Cancel order (ownership check, status validation, auto Stripe refund)
- [x] Live order tracking: Leaflet map + Socket.IO (driver position, ETA, route); last known position persisted per order and replayed on join
- [x] Direct tracking links work after refresh (order fetched by ID; 10 s polling fallback when Socket.IO is unavailable)
- [x] Map-pin/GPS coordinates are authoritative for checkout and live tracking; 7-day address cache with edit invalidation
- [x] Animated status progress bar
- [x] Restaurant reviews (only after a delivered order; one review per restaurant/item)
- [x] Featured restaurants & menu items carousel
- [x] "Order Now" button on menu items
- [x] Light/Dark mode (persisted; no flash — inline theme script)
- [x] Fully responsive (mobile-first)
- [x] Success page resolves the real Stripe session, shows pending/failed states, clears cart only after confirmation

### Restaurant Owner Features
- [x] Create restaurant with **drag-pin map** (Leaflet) + "Use My Location"; saved coordinates are not overwritten by initial reverse-geocoding, GPS forces a fresh fix
- [x] Update restaurant details & location (by ID or current restaurant)
- [x] **Multiple restaurants per owner** — `?restaurantId=` scoping, `my-restaurants`, per-restaurant order/menu queries
- [x] Menu CRUD with Cloudinary images (multi-restaurant aware)
- [x] Mark restaurant/menu items as Featured
- [x] Order management dashboard (all owned restaurants, including COD)
- [x] Update order status (validated transitions)
- [x] Assign delivery partner (driver role)
- [x] Dedicated owner navbar (Dashboard / My Restaurants / Orders)

### Backend / Infrastructure
- [x] MongoDB + Mongoose models: User, Restaurant, Menu, Order, Review
- [x] REST API (Express + TypeScript); sources live in `server/` (no `src/`)
- [x] Central env loader (`server/config/env.ts`) imported before all env reads; startup validates required vars
- [x] Zod request validation (`server/schemas/validation.ts`) — body/query/**params** (object schemas), multipart coercion
- [x] ObjectId guards on restaurant detail/review requests — every detail link is validated, malformed IDs rejected client-side, 400 vs 404 distinguished server-side with strict 24-hex checks (`server/utils/objectId.ts`)
- [x] `npm start` rebuilds `dist/` before launching, so a stale compiled server cannot serve old validation code
- [x] Reusable middlewares: `validate`, `sanitizeBody`, `preventMassAssignment`, `isAuthenticated`, `isAdmin`, `rateLimit`
- [x] Stripe: Checkout Sessions, Webhooks, Refunds; **idempotent** webhook processing (24 h TTL map)
- [x] COD + Stripe orders use MongoDB transactions when connected to a replica set/`mongos`; standalone MongoDB uses compensating writes (delete/revert + counter rollback) with a startup warning
- [x] Socket.IO per-order rooms with JWT auth, ownership checks, 3 s location rate limit
- [x] Cloudinary image upload (multer)
- [x] OpenCage geocoding (autocomplete, reverse geocode, pincode lookup, route/ETA)
- [x] Helmet CSP/HSTS, CORS allow-list, `trust proxy` for correct client IPs
- [x] Rate limiting (auth, checkout, map, review, API, strict)
- [x] Structured logging (pino)
- [x] Health check (`GET /health`) with DB state and transaction topology
- [x] Local single-node replica set (`npm run mongo:start`, port `27018`) + safe port-scoped stop script (`npm run kill`)
- [x] Graceful shutdown (SIGINT/SIGTERM)

### Testing & DevOps
- [x] Vitest + Supertest: auth, orders/payments, maps, reviews, Socket.IO tracking, owner dashboard (restaurant/menu/order)
- [x] `mongodb-memory-server` uses an installed `mongod` when available and runs a **single-node replica set** (transactions supported)
- [x] `npm test` / `npm run test:watch`
- [x] Nodemon watches **all** server source directories (`schemas`, `config`, `services`, `socketHandlers`, etc.) so schema/config edits always trigger a restart
- [x] Frontend → Vercel; Backend → Render
- [x] Stripe CLI for local webhook testing

---

## 🚧 In Progress / Planned

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-server Socket.IO (Redis adapter) | Planned | In-memory driver registry is single-instance only |
| Redis-backed webhook idempotency | Planned | Current map is in-memory (TTL cleanup) |
| Frontend unit/E2E tests | Planned | Backend suite only |

---

## ❌ Not Implemented / Explicitly Removed

| Feature | Reason |
|---------|--------|
| Email verification (OTP) | Removed — accounts active immediately |
| Forgot/Reset password | Removed — routes/components deleted in this audit |
| Guest checkout | Intentional — all orders tied to user accounts |
| Multi-restaurant cart | Intentionally blocked (one restaurant per order) |
| Loyalty/rewards program | Not in scope |
| Multi-language (i18n) | English only for now |
| Push notifications | Socket.IO covers real-time; push not needed |

---

## 📡 API Contract (Current)

All routes are prefixed with `/api/v1`. Auth = HTTP-only `token` cookie.

### Auth / User
- `POST /user/signup` — `{fullname, email, password, contact?}` → 201 + cookie
- `POST /user/login` — `{email, password}` → 200 + cookie
- `POST /user/logout` — → 200 (clears cookie)
- `GET /user/check-auth` — → 200 + user
- `PUT /user/profile/update` — `{fullname?, email?, contact?, alternateContact?, address?, pincode?, city?, state?, country?, profilePicture?}` → 200 + user

### Restaurant
- `POST /restaurant/` — **multipart** `{restaurantName, city, country, pincode, deliveryTime, deliveryPrice?, cuisines, lat, lng, imageFile?}` → 201
- `GET /restaurant/` — owner's restaurant; optional `?restaurantId=` → 200
- `GET /restaurant/my-restaurants` — → 200 + array
- `PUT /restaurant/` or `PUT /restaurant/:id` — partial update → 200
- `DELETE /restaurant/:id` — → 200
- `GET /restaurant/all` — paginated public list
- `GET /restaurant/search` / `GET /restaurant/search/:searchText` — `?selectedCuisines=&city=&minPrice=&maxPrice=`
- `GET /restaurant/filters` — `{cuisines[], dishNames[]}`
- `GET /restaurant/order` — orders across all owned restaurants (paginated)
- `PUT /restaurant/order/:orderId/status` — `{status}` → 200
- `GET /restaurant/:id` — public details

### Menu
- `POST /menu/` — **multipart** `{name, description, price, image?, restaurantId?}` → 201
- `GET /menu/` — paginated all menus
- `GET /menu/popular` — top menus by `orderCount`
- `GET /menu/restaurant/:restaurantId` — paginated menu
- `PUT /menu/:id` — partial update
- `DELETE /menu/:id` — owner-only

### Order
- `POST /order/checkout/create-checkout-session` — `{cartItems[], deliveryDetails{name,email,address,city,pincode,lat?,lng?}, restaurantId, paymentMethod: "stripe"|"cod"}` → 200 `{session?, orderId}` (COD returns `order`)
- `POST /order/webhook` — raw body + `stripe-signature`; idempotent
- `GET /order/` — paginated user orders (owner sees owned via `/restaurant/order`)
- `GET /order/session/:sessionId` — Stripe redirect lookup (`cs_test_…` / `cs_live_…`)
- `GET /order/:orderId` — owner or restaurant owner
- `POST /order/:orderId/cancel` — ownership + transition validation; refunds Stripe

### Map & Tracking
- `GET /map/pincode/:pincode` — 6-digit pincode lookup
- `GET /map/autocomplete?q=` — OpenCage proxy (auth, min 3 chars)
- `POST /map/validate-address` — `{address, pincode}`
- `POST /map/check-delivery` — `{restaurantId, customerAddress, customerPincode}`
- `POST /map/restaurant/distance` — `{customerCoords, restaurantId}` (owner)
- `POST /map/tracking/route` — `{driverCoords, customerCoords}`
- `POST /map/delivery-time` — `{distanceKm}`
- `POST /map/reverse-geocode` — `{lng, lat}`

### Socket.IO events
- Client → server: `customer:join {orderId}`, `driver:join {orderId}`, `driver:location {orderId, location{lng,lat}, status}`
- Server → client: `driver:joined`, `location:update`, `error {message}`
- Auth: JWT via `auth.token` or `token` cookie; role `driver`/`isDriver` required for driver events

---

## 🔧 Environment Variables

### Backend (`server/.env`) — required (validated at startup)
```env
PORT=8001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173          # comma-separated allowed origins
MONGO_URI=mongodb://127.0.0.1:27018/suman_food?replicaSet=rs0
SECRET_KEY=your-super-secret-jwt-key-min-32-chars   # >= 32 chars enforced
STRIPE_SECRET_KEY=sk_test_...
WEBHOOK_ENDPOINT_SECRET=whsec_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
OPENCAGE_API_KEY=...
DELIVERY_SPEED_KM_PER_MIN=0.333
MAX_DELIVERY_RADIUS_KM=10
MIN_ORDER_AMOUNT=50
```
> Local development uses `npm run mongo:start` (single-node `rs0` on `27018`). Production should use MongoDB Atlas or another replica set for atomic checkout/webhook updates. A standalone database still works via compensating writes; `GET /health` shows the active topology.

### Frontend (`client/.env`)
```env
VITE_API_BASE_URL=http://localhost:8001/api/v1
VITE_SOCKET_URL=http://localhost:8001
```

### Test overrides (optional)
```env
MONGODB_TEST_URI=mongodb://...      # skip in-memory server entirely
MONGOMS_SYSTEM_BINARY=/path/to/mongod
```

---

## 🐛 Known Issues (Open)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| — | — | No open bugs | — |

*BUG-002 (mobile marker drag snap) is marked **Won't Fix** — not reproducible; coordinates are read from Leaflet's authoritative `getLatLng()` on `dragend`.*
*See `.bug-reports/BUG_LOG.md` for the full history (BUG-001…BUG-035).*

---

## 📦 Dependencies (Key)

### Frontend (`client/package.json`)
- `react@18`, `react-dom@18`, `react-router-dom@6`
- `vite@5`, `typescript@5`, `tailwindcss@3`
- `zustand@4`, `axios@1`, `socket.io-client@4`
- `leaflet@1.9`, `react-leaflet@4`
- `@radix-ui/*`, `sonner`, `zod`, `@hookform/resolvers`
- `lucide-react`, `date-fns`, `clsx`, `tailwind-merge`, `framer-motion`

### Backend (`server/package.json`)
- `express@4`, `typescript@5`, `mongoose@8`, `zod@4`
- `socket.io@4`, `jsonwebtoken@9`, `bcryptjs@2`
- `stripe@16`, `cloudinary@2`, `multer@1`
- `express-rate-limit@8`, `helmet@8`, `cors@2`, `cookie-parser@1`, `dotenv@16`, `body-parser@1`
- `pino@10`, `pino-pretty@13`, `ioredis@6`
- Dev: `vitest@5`, `supertest@7`, `mongodb-memory-server@11`, `nodemon@3`, `tsx@4`

---

## 🌐 Deployment Status

| Environment | Frontend | Backend | Database | Status |
|-------------|----------|---------|----------|--------|
| Local | `http://localhost:5173` | `http://localhost:8001` | Local replica set `rs0` on `27018` (`npm run mongo:start`) | ✅ Working |
| Production | Vercel | Render | MongoDB Atlas (transactions supported) | ✅ Working |
| Staging | — | — | — | Not configured |

---

## 🔐 Security Posture

- [x] Passwords hashed (bcrypt), never returned
- [x] JWT in HTTP-only cookies (not localStorage)
- [x] Cookies: `secure: true`, `sameSite: "none"` (prod), `"lax"` (dev)
- [x] Startup validation for required env vars (incl. webhook secret)
- [x] Stripe webhook signature verification + idempotency
- [x] Server-side price verification (DB prices only)
- [x] Server-side ownership checks on orders, menus, restaurants, reviews, tracking
- [x] Input validation (Zod) for body/query/params + Mongoose validation
- [x] Rate limiting (IP/IPv6-subnet aware) + `trust proxy`
- [x] Helmet CSP, HSTS, referrer policy
- [x] CORS allow-list (`FRONTEND_URL`)
- [x] `sanitizeBody` blocks Mongo operators / dotted keys
- [x] `.env` files git-ignored; no secrets in code

---

## 📊 Test Coverage

| Layer | Coverage | Notes |
|-------|----------|-------|
| Backend integration | **92 tests / 7 suites** | `server (npm test)` — auth, orders/payments, maps, reviews, tracking, restaurant detail, owner dashboard |
| Frontend unit | ~0% | Not configured |
| E2E | Manual | Cypress/Playwright not set up |

**Verified 2026-10-26:**
- `server: npx tsc --noEmit` → ✅
- `client: npx tsc -b` → ✅
- `client: vite build` → ✅ (vendor chunks split)
- `server: npx vitest run` → ✅ 7/7 suites, 92/92 tests
- `server: npm run build && node dist/index.js` → ✅ `GET /health` returns 200, `database: "connected"`, `transactions: { supported: true, topology: "replica-set" }`
- Local checkout against replica set → ✅ COD order returned 200, persisted as `confirmed`, menu `orderCount` incremented, then test data cleaned up
- Local checkout against standalone `27017` (temporary port `8002`) → ✅ COD order returned 200 through compensating writes; `GET /health` reported `transactions.supported: false`; test data cleaned up
- Port hygiene → ✅ `npm run kill` stopped only backend port `8001`/nodemon; preflight rejects a second backend start; one backend and one Vite instance left running
- Owner dashboard API (restaurant load/update, menu list/edit, order list/status) → ✅ 200 with current build; 400 with a pre-fix `node dist/index.js` process (stale-module incident, BUG-031)
- Map APIs with a selected pin → ✅ `/map/validate-address` returns the submitted `[lng, lat]` (`source: "map-pin"`) and a pin-reverse-geocoded address; `/map/check-delivery` accepts the pin and returns distance/ETA (BUG-032)
- Live tracking persistence → ✅ driver `driverLocation` saved on every accepted update; `customer:join` replays `tracking:snapshot`

---

## 📝 Next Steps for New Contributors

1. Read `PROJECT_OVERVIEW.md` (`.project-docs/`)
2. Review `CHANGELOG.md` for recent context
3. Check `BUG_LOG.md` for history (no open bugs)
4. Run locally: `cd server && npm run dev` + `cd client && npm run dev` (the backend preflight starts the local replica set automatically; or use `start-dev.bat` from the root)
5. Set up `.env` files (see above)
6. Run tests: `cd server && npm test`
7. Test full flow: signup → create restaurant → add menu → order (Stripe + COD) → track → cancel → review
