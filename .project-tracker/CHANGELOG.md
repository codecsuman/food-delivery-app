# Changelog — Suman Food (Food Delivery App)

> **Format:** `YYYY-MM-DD` | `Author` | `Type` | `Files Changed` | `Description`
> **Types:** `feat` (new feature), `fix` (bug fix), `refactor`, `docs`, `config`, `deps`, `deploy`, `security`

---

## 2026-10-26 | AI Agent (OpenCode) | fix | `server/utils/transactions.ts`, `server/controller/order.controller.ts`, `server/db/connectDB.ts`, `server/index.ts`, `server/package.json`, `server/scripts/ensure-port-free.mjs`, `server/scripts/ensure-local-mongo.mjs`, `server/scripts/stop-server.mjs`, `server/scripts/start-local-mongo.ps1`, `server/scripts/migrate-local-mongo.mjs`, `server/start-server.bat`, `start-dev.bat`, `quick-start.bat`, `server/.env.example`, `README.md` | Fixed standalone-MongoDB checkout failure and duplicate backend port conflict
- **Root cause:** the local Windows MongoDB service was a standalone `mongod`, but COD checkout and webhook confirmation use `session.withTransaction()`. MongoDB rejected the session with code `20` (`Transaction numbers are only allowed on a replica set member or mongos`), so checkout returned 500.
- **Local database fixed:** added `npm run mongo:start`, which starts a user-space single-node replica set (`rs0`) on `127.0.0.1:27018` without administrator rights. The existing `suman_food` data was migrated to it, and `.env` now uses `mongodb://127.0.0.1:27018/suman_food?replicaSet=rs0`.
- **Production preserved:** Atlas (`mongodb+srv`) remains transaction-capable. No transaction code was removed.
- **Standalone safety net:** new `server/utils/transactions.ts` detects replica set/`mongos` support and runs checkout/webhook writes in a transaction when possible. On a standalone server it uses compensating writes (delete the new COD order or restore the previous webhook order state, then decrement menu counters) so local checkout still works instead of returning 500.
- **Observability:** startup logs the active topology; `GET /health` now returns `transactions: { supported, topology }`; transaction support is re-probed after a reconnect.
- **Port conflict fixed:** `npm run kill` now stops only the backend port/nodemon instead of killing every `node.exe` (which previously killed Vite and VS Code helpers). `predev`/`prestart` reject a second backend with a clear message, and `start-dev.bat`/`quick-start.bat` stop the old backend before launching one instance.
- **Dev setup:** `start-dev.bat` and the backend `predev`/`prestart` hooks now start the local replica set automatically when `MONGO_URI` points at `127.0.0.1:27018`; `npm run mongo:start` remains available for manual/startup use.
- **Verified:** `server` 7/7 suites, 92/92 tests; `server` `tsc --noEmit`; live COD checkout on the replica set returned 200 and persisted `confirmed` with the menu counter incremented; live COD checkout against standalone `27017` also returned 200 through the fallback; both test orders were deleted. Fixes #BUG-034 and #BUG-035.

---

## 2026-10-26 | AI Agent (OpenCode) | fix | `client/src/lib/validation.ts`, `client/src/components/SearchPage.tsx`, `client/src/components/MyOrders.tsx`, `client/src/components/RestaurantDetail.tsx`, `client/src/components/LiveTracking.tsx`, `client/src/store/useReviewStore.ts`, `client/src/store/useRestaurantStore.ts`, `server/utils/objectId.ts`, `server/controller/restaurant.controller.ts`, `server/controller/review.controller.ts`, `server/tests/restaurant.test.ts`, `server/tests/dashboard.test.ts` | Permanent fix for invalid restaurant/review IDs and Socket.IO handshake warning
- **Root cause of the remaining 400s:** two navigation paths still built `/restaurant/${id}` from an unchecked value (`SearchPage` used `restaurant._id` directly; `MyOrders` fell back to an undefined populated id). A missing value became the literal string `undefined`, which is not a 24-char ObjectId, so both `GET /restaurant/:id` and `GET /review/restaurant/:id` returned `400`.
- **Every link now validated:** `getRestaurantId()` is the single source of truth for detail URLs. Search cards and order "Reorder" links only render when a real ObjectId is present; otherwise they render a disabled control.
- **No stale restaurant rendering:** the detail page only uses a persisted `singleRestaurant` when its `_id` matches the `:id` in the URL, so a deep link can never render a restaurant left over from a previous session (the persisted copy is still used for checkout totals after a refresh).
- **Review UI states:** the review store now exposes `reviewsError`; the detail page shows loading skeletons, a retryable error state, and the existing empty state instead of silently showing "No reviews yet".
- **Strict ObjectId checks:** added `server/utils/objectId.ts` (`^[0-9a-fA-F]{24}$`) and used it in restaurant/review lookups. This closes the Mongoose gap where a 12-byte string such as `123456789012` was considered valid. Malformed IDs → 400; valid-but-missing restaurants → 404.
- **Socket.IO:** the tracking client now creates the socket with `autoConnect: false` and connects on a deferred tick, so React StrictMode's throw-away first mount never opens (and immediately kills) a WebSocket. This removes the "WebSocket is closed before the connection is established" warning; the server still uses the default `/socket.io` path and credentials.
- **Tests:** `server/tests/restaurant.test.ts` now also covers a 12-byte id (400), and `server/tests/dashboard.test.ts` covers a 12-byte `?restaurantId=` query (400). Fixes #BUG-033.
- **Verified:** `server` 7/7 suites, 92/92 tests; `server` `tsc` build; `client` `tsc -b && vite build` all pass.

---

## 2026-10-26 | AI Agent (OpenCode) | fix | `server/schemas/validation.ts`, `server/routes/map.route.ts`, `server/models/order.model.ts`, `server/socketHandlers/trackingSocket.ts`, `client/src/components/AddressPicker.tsx`, `client/src/components/CheckoutConfirmPage.tsx`, `client/src/components/DeliveryTimeEstimator.tsx`, `client/src/components/LiveTracking.tsx`, `client/src/App.tsx`, `client/src/admin/Restaurant.tsx`, `client/src/types/orderType.ts`, `server/tests/map.test.ts`, `server/tests/tracking.test.ts` | Fixed stale restaurant/address/live-tracking map data
- **Pin is authoritative:** `/map/validate-address` and `/map/check-delivery` now accept optional `lat`/`lng`; when supplied, the pin/GPS position is used instead of re-geocoding text, and the formatted address is reverse-geocoded from the pin.
- **AddressPicker:** places the saved marker/GPS position, supports draggable pins, sends exact coordinates on validation, returns structured city/state/country, clears stale pincode metadata when the pin moves, and no longer submits its parent form.
- **Checkout:** persisted addresses include `savedAt` with a 7-day TTL; legacy entries are dropped, edits clear old coordinates, the manual form has a pincode field, and current coordinates are resolved on every submit. ETAs use the chosen pin.
- **Live tracking:** orders persist `driverLocation`/`driverLocationUpdatedAt` on every accepted update; `customer:join` immediately replays a `tracking:snapshot`. The map reacts to refreshed props, fits bounds even if routing fails, ignores older polled positions, and the page polls every 10 s as a Socket.IO fallback.
- **Production socket:** `SOCKET_URL` is derived from `VITE_API_BASE_URL`/page origin instead of falling back to `localhost:8001`.
- **Restaurant map:** loading a saved restaurant no longer reverse-geocodes and overwrites stored pincode/city/country; GPS requests force a fresh fix.
- **Tests:** map suite now covers pin-coordinate precedence for validation and delivery; tracking suite verifies DB persistence and snapshot replay. Fixes #BUG-032.
- **Verified:** `server` 7/7 suites, 90/90 tests; `server` `tsc --noEmit`; `client` `tsc -b && vite build`. Live API: pin `(22.6, 88.5)` returned `[88.5, 22.6]` with `source: "map-pin"`; live delivery check returned 200.

---

## 2026-10-25 | AI Agent (OpenCode) | fix | `server/nodemon.json`, `server/tests/dashboard.test.ts`, `client/src/admin/Restaurant.tsx`, `client/src/admin/AddMenu.tsx`, `client/src/admin/EditMenu.tsx`, `client/src/admin/Orders.tsx` | Restored owner dashboard restaurant/menu/order flow
- **Root cause:** The backend on port 8001 was a stale `node dist/index.js` process started before the param-validation fix was compiled, so every dashboard request still hit the old bare-string param schema and returned 400 `expected string, received object`.
- **Dev reload:** `nodemon.json` now watches all server source directories (`schemas`, `config`, `services`, `socketHandlers`, etc.), so schema changes can no longer leave a dev server running stale validation code.
- **Regression coverage:** Added `server/tests/dashboard.test.ts` (10 tests): restaurant load/update, menu-by-restaurant listing and edit, order listing, status transitions, cross-owner authorization, and malformed IDs.
- **Verified:** Manual end-to-end multipart flow — create restaurant → add menu → edit/delete menu → update restaurant with/without image → list orders → advance status — all return 200. `server` 7/7 suites, 87/87 tests; `server` `tsc --noEmit`; `client` `tsc -b && vite build` all pass. Fixes #BUG-031.

---

## 2026-10-25 | AI Agent (OpenCode) | fix | `server/package.json`, `client/src/lib/validation.ts`, `client/src/store/useRestaurantStore.ts`, `client/src/store/useReviewStore.ts`, `client/src/components/FeaturedMenus.tsx`, `client/src/components/RestaurantDetail.tsx`, `client/src/components/LiveTracking.tsx`, `client/src/types/restaurantType.ts`, `server/tests/restaurant.test.ts` | Fixed restaurant detail/review 400 loop
- **Root cause:** The running `node dist/index.js` process used a stale build whose param validator expected a bare string while Express supplies `req.params` as an object. Source and a fresh build were already correct.
- **Stale-build guard:** `npm start` now runs `npm run build` before `node dist/index.js`.
- **Client validation:** Added shared ObjectId helpers; malformed IDs are rejected locally instead of producing guaranteed 400s.
- **Request safety:** Restaurant/review stores dedupe StrictMode in-flight requests and ignore out-of-order responses when navigating quickly.
- **UI:** `RestaurantDetail` now renders an explicit not-found/invalid screen with retry and browse actions instead of an endless skeleton.
- **Links:** Home dish cards resolve restaurant IDs from populated or raw references and never link to invalid values.
- **Socket.IO:** Removed forced WebSocket-first transport and hardened cleanup, eliminating the "closed before connection is established" warning on StrictMode double mounts.
- **Tests:** Added `server/tests/restaurant.test.ts` covering valid (200), malformed (400), non-hex 24-char (400), missing (404), and review lookups. Fixes #BUG-030.
- **Verified:** `server` 77/77 tests, `server` `tsc --noEmit`, `client` `tsc -b && vite build` all pass.

---

## 2026-10-18 | AI Agent (OpenCode) | docs | `.project-docs/PROJECT_OVERVIEW.md`, `.project-tracker/CHANGELOG.md`, `.project-tracker/RULES.md`, `.project-tracker/CURRENT_STATE.md`, `.bug-reports/BUG_LOG.md` | Created project documentation & tracking infrastructure (not committed to Git)

---

## 2026-10-18 | Suman Jhanp | feat | Multiple | **Major Production-Readiness Update** (from README "What's New")
- **Payment**: Added Cash on Delivery (COD) alongside Stripe; both include delivery fee
- **Validation**: Server-side `MIN_ORDER_AMOUNT` enforcement before Stripe session creation
- **Order Integrity**: Order created only after Stripe success; automatic rollback on failure (no orphan pending orders)
- **Failed Payments**: Fixed webhook matching via PaymentIntent metadata (`orderId` in `payment_intent_data`)
- **Restaurant Geolocation**: Drag-pin map (Leaflet) + "Use My Location" for accurate coordinates
- **Live Tracking**: Real-time Socket.IO + Leaflet map with driver position, ETA, route — per-order auth
- **Cross-Origin**: Fixed cookies (secure + sameSite: none) & CORS for Vercel ↔ Render
- **Auth**: Removed email verification (OTP) flow entirely; accounts active immediately
- **Cancel Order**: Full flow with ownership check, status validation, auto Stripe refund
- **Order Lookup**: `getOrderBySessionId` for post-Stripe-redirect recovery
- **Stripe Webhook**: Added `checkout.session.completed` + `payment_intent.payment_failed` with signature verification
- **UI**: Animated status progress bar, Active/Past order tabs, "Order Now" button, featured carousel, reviews
- **Driver Assignment**: Real driver role replaces simulated location updates

---

## 2026-10-19 | AI Agent (OpenCode) | refactor | Multiple | **Major Code Cleanup & Garbage Removal**
- **Removed build artifacts**: Deleted `server/dist/` (100+ compiled files) — regenerated via `npm run build`
- **Removed dead code**: 
  - `server/utils/generateVerificationCode.ts` (unused, email verification removed)
  - `server/utils/imageUpload.ts` (unused, replaced by cloudinary.ts)
  - `client/src/components/MainLayout.tsx` (duplicate, `client/src/layout/MainLayout.tsx` used)
- **Removed console.logs**: Cleaned 100+ `console.log/warn/error` statements across server controllers, middleware, utilities, and client components/stores — kept only critical Cloudinary error logs
- **Fixed simulated API**: Removed fake `setTimeout` delay in `Contact.tsx` contact form
- **Fixed TypeScript errors**: Unused `err` parameters in `LiveTracking.tsx`
- **Verified builds**: Both `server` (`tsc`) and `client` (`tsc -b && vite build`) compile successfully

---

## 2026-10-19 | AI Agent (OpenCode) | fix | `client/src/components/CheckoutConfirmPage.tsx`, `client/src/App.tsx`, `server/socketHandlers/trackingSocket.ts` | **Live Tracking System Fixes**
- **Checkout now requires delivery coordinates**: User must select address on map (via AddressPicker) before placing order — lat/lng sent with order
- **Socket handler fixed**: Now reads customer location from `deliveryDetails.lat`/`deliveryDetails.lng` instead of non-existent `deliveryDetails.coordinates`
- **LiveTrackingPage validation**: Redirects to `/address-picker` with toast notification if order lacks customer coordinates
- **Address picker integration**: Checkout flow now enforces map-based address selection for live tracking to work
- **Verified builds**: Both server and client compile successfully

---

## 2026-10-19 | AI Agent (OpenCode) | feat | `server/models/restaurant.model.ts`, `server/controller/restaurant.controller.ts`, `client/src/schema/restaurantSchema.ts`, `client/src/admin/Restaurant.tsx` | **Restaurant Pincode & Auto-Location Features**
- **Pincode field added**: Required 6-digit pincode validation on both server (Mongoose) and client (Zod schema)
- **Auto-fill via reverse geocoding**: When user sets location via map drag, map click, or "Use My Location" button, pincode/city/country are auto-filled using OpenCage reverse geocoding
- **Map integration enhanced**: Existing draggable marker + GPS location now triggers reverse geocode to populate address fields
- **Form includes pincode input**: Manual override available with map pin icon
- **Server persistence**: Pincode stored in restaurant model, included in create/update operations
- **Verified builds**: Both server (`tsc`) and client (`tsc -b && vite build`) compile successfully

---

## 2026-10-19 | AI Agent (OpenCode) | feat | `server/controller/menu.controller.ts`, `server/routes/menu.route.ts`, `client/src/store/useMenuStore.ts`, `client/src/components/FeaturedMenus.tsx` | **Popular Dishes Section on Home Page**
- **New endpoint**: `GET /api/v1/menu/popular` returns menus sorted by `orderCount` (most ordered first) with `createdAt` as tiebreaker
- **Fixed limit**: **Max 6 items** for home page popular section
- **Home page updated**: FeaturedMenus now shows "Popular Dishes" instead of "Freshly Added Dishes"
- **Order count badge**: Each popular dish card shows order count (e.g., "50+ orders") with trending icon
- **Restaurant name**: Cards now display restaurant name for context
- **Separate store state**: Added `popularMenus` to menu store with dedicated `getPopularMenus` action
- **Backend sorting**: Uses existing `orderCount` field (incremented on each order) with index for performance
- **Verified builds**: Both server (`tsc`) and client (`tsc -b && vite build`) compile successfully

---

## 2026-10-19 | AI Agent (OpenCode) | feat | `client/src/components/FeaturedMenus.tsx` | **Animated All Dishes Section with Color Themes**
- **Switched from Popular to All Dishes**: Home page middle section now shows all dishes via `getAllMenus`
- **4 Color Themes**: Cards cycle through Orange/Amber, Yellow/Amber, Emerald/Teal, Orange/Red gradients
- **Scroll Animations**: IntersectionObserver triggers staggered fade-in/scale-up animations as cards enter viewport
- **Hover Effects**: Cards lift, scale, glow with theme-colored shadow; image zooms; floating particles animate
- **Theme Accents**: Top bar, price badge, order badge, particles all use card's assigned gradient
- **Staggered Entrance**: Framer Motion orchestrates sequential card reveals with spring physics
- **Gradient Header**: Animated pulsing background with "All Dishes" title in gradient text
- **Verified builds**: Both server (`tsc`) and client (`tsc -b && vite build`) compile successfully

---

## 2026-10-25 | AI Agent (OpenCode) | fix / security / test | `server/`, `client/src/`, `client/index.html`, docs | **Full file-by-file audit — 29 bugs resolved, tests green**
- **Environment loading**: added `server/config/env.ts` (side-effect `dotenv` loader) imported first in `index.ts`; removed inline/misplaced `dotenv` calls
- **Validation / API**:
  - Fixed route-param validation — scalar schemas were used against `req.params` objects (all ID/pincode/session routes returned 400)
  - Added `idParamSchema`, `orderIdParamSchema`, `restaurantIdParamSchema`, `pincodeParamSchema`, `stripeSessionIdParamSchema`
  - Multipart coercion for restaurant/menu forms (`z.coerce.number`, JSON-decoded `cuisines`)
  - ObjectId heuristic now only applies to `*Id`/`*_id` params (pincode 400 fixed)
  - `addMenuSchema.restaurantId` optional; price `0` allowed
- **Routing / ownership**:
  - `/order/session/:sessionId` registered before `/:orderId`
  - Stripe webhook registered with raw body before `express.json()`; idempotent `processedWebhookEvents` with 24 h cleanup
  - Multi-restaurant owner queries scoped by all owned restaurant IDs; menu edit/delete validates `menu.restaurant`
  - `restaurant.update` accepts `/:id` or `/`, optional `?restaurantId=` on `GET /restaurant`
- **Security**: `app.set("trust proxy", 1)`; removed custom rate-limit key generator (fixes `ERR_ERL_KEY_GEN_IPV6` / IPv6 bypass); rate limiting skipped for `/health` and tests
- **Models**: `deliveryDetails.pincode`, `user.state`, order `cartItems.image` default `""`, tracking fields already declared
- **Checkout / cart (client)**: cart restaurant derived from items; mixed-restaurant carts blocked; real Stripe `session_id` resolution in `Success.tsx`; cart cleared only after confirmed payment; `getOrderById` upserts into the store
- **Tracking / maps (client)**: fixed `DeliveryTimeEstimator` infinite loop (primitive deps + `AbortController`); deep-link order fetch + loading/not-found states; `LiveTracking` accepts real `initialStatus`; `AddressPicker` cleans up the map, debounces autocomplete, and returns `city`/`state`/`country`
- **Profile / admin / UI**: profile `state` persisted (model + schema + controller + form), deduplicated auto-location effect, truthful success toast; `AddMenu` loads restaurant and sends `restaurantId`; `EditMenu` guards missing selection; shared inline-SVG image fallback (`client/src/lib/placeholder.ts`) replacing dead `via.placeholder.com`; `FeaturedMenus` static Tailwind themes
- **UX**: inline theme script in `client/index.html` removes dark-mode flash (BUG-001)
- **Tests / tooling**:
  - `tests/setup.ts` reuses an installed `mongod` and runs a single-node **replica set** (transactions work), no 700 MB download
  - Constructible Stripe mock with signature verification; axios defaults; env defaults
  - Fixed `map.test.ts` missing `mongoose` import, `socket.io` `Server` import, webhook route registration, delivered-order review fixtures, and rewrote socket tests as promise-based with deterministic cleanup
  - Added `"test": "vitest run"` / `"test:watch"` scripts; `hookTimeout` 180 s
  - **Result: 5/5 suites, 71/71 tests pass**
- **Deps**: removed invalid `"server": "file:.."` and backend-only `@types/*` from `client/package.json`
- **Build**: added Vite `manualChunks` (react/map/ui/data vendors) for long-term caching and smaller main chunk
- **Docs**: updated `BUG_LOG.md` (BUG-001…029), `CURRENT_STATE.md`, `PROJECT_OVERVIEW.md`
- **Verified**: `server: npx tsc --noEmit` ✅ · `client: npx tsc -b` ✅ · `client: vite build` ✅ · `server: npx vitest run` ✅ (5/5 suites, 71/71) · production build smoke test `GET /health` → 200 `{database:"connected"}` ✅

---

## Template for Future Entries

```markdown
## YYYY-MM-DD | Author Name | type | file1.ts, file2.tsx | Brief description of what changed and why
- Detail 1
- Detail 2
```