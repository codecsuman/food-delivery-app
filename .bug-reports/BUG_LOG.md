# Bug Log — Suman Food

> **Purpose:** Track all discovered UI/UX bugs, logic errors, performance issues, and security concerns.
> **Format:** Each bug gets a unique ID (`BUG-XXX`), severity, status, reproduction steps, and resolution.
> **Location:** `C:\Users\SUMAN JHANP\PROGRAMMING\MERN\food-app-yt-main/.bug-reports/BUG_LOG.md`
> **Last Updated:** 2026-10-26

---

## 📋 Bug Template

When logging a new bug, copy this template:

```markdown
## BUG-XXX: [Short Title]

- **Severity:** Critical / High / Medium / Low
- **Type:** UI/UX / Logic / Performance / Security / Regression
- **Status:** Open / In Progress / Fixed / Verified / Won't Fix
- **Reported By:** [Name / AI Agent]
- **Reported On:** YYYY-MM-DD
- **Affected Files:** `path/to/file1.tsx`, `path/to/file2.ts`
- **Environment:** Local / Production / Both
- **Browser/Device:** [e.g., Chrome 120, iOS Safari, Desktop]

### Description
[Clear description of the bug — what happens vs. what should happen]

### Reproduction Steps
1. Step 1
2. Step 2
3. Step 3
4. Observe bug

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Screenshots / Logs
[Attach if helpful]

### Root Cause (if known)
[Analysis]

### Fix / Workaround
[Description of fix or temporary workaround]

### Related CHANGELOG Entry
[Link to CHANGELOG.md entry when fixed, e.g., `2026-10-20 | ... | fix | ...`]

### Verified On
[Date + environment when fix verified]
```

---

## 🐛 Logged Bugs

---

## BUG-001: Dark mode flash on initial load (SSR mismatch)

- **Severity:** Low
- **Type:** UI/UX
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-18
- **Affected Files:** `client/src/store/useThemeStore.ts`, `client/src/App.tsx`, `client/src/main.tsx`
- **Environment:** Both
- **Browser/Device:** All browsers

### Description
On initial page load, the app briefly shows light mode before switching to the user's preferred dark mode (stored in localStorage/Zustand). This is a classic SSR hydration mismatch — the server renders light mode, then client hydrates and applies dark mode.

### Reproduction Steps
1. Set theme to dark mode in app
2. Refresh page (hard refresh: Ctrl+Shift+R)
3. Observe brief white/light flash before dark mode applies

### Expected Behavior
No flash — initial render matches user's stored preference.

### Actual Behavior
Brief (~100-300ms) light-mode flash on every hard refresh.

### Root Cause
`useThemeStore` reads from `localStorage` in a `useEffect` (client-only), but initial render uses default (light). Vite/React doesn't support `getInitialProps` for this.

### Fix / Workaround
- **Fixed (2026-10-25):** Added a blocking inline script in `client/index.html` `<head>` that reads `theme-store` from `localStorage`, resolves `system` via `prefers-color-scheme`, and applies the `dark`/`light` class plus `color-scheme`/background before React or CSS loads.

### Related CHANGELOG Entry
`2026-10-25 | AI Agent (OpenCode) | fix | client/index.html | ...`

### Verified On
2026-10-25 — hard refresh with dark theme selected; no light flash before the app renders.

---

## BUG-002: Map marker drag sometimes snaps to wrong coordinates on mobile

- **Severity:** Low
- **Type:** UI/UX
- **Status:** Won't Fix
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-18
- **Affected Files:** `client/src/admin/Restaurant.tsx` (map picker component), `client/src/components/ui/*` (if reusable map component)
- **Environment:** Both
- **Browser/Device:** Mobile Chrome/Safari, touch devices

### Description
When a restaurant owner drags the location pin on the map (Leaflet) on mobile/touch devices, the marker occasionally snaps to an incorrect position (offset by ~50-200m) on release.

### Reproduction Steps
1. Open Dashboard → Restaurant on mobile browser
2. Drag the map pin to a new location
3. Release — observe marker jumps to slightly wrong spot
4. Coordinates saved are the wrong ones

### Expected Behavior
Marker stays exactly where dragged; saved coordinates match visual position.

### Actual Behavior
Marker snaps to nearest "grid" or tile boundary on touchend.

### Root Cause
Leaflet's `draggable` + touch events + map `zoom`/`pan` interaction conflict. May be related to `react-leaflet` event handling or CSS transform on map container.

### Fix / Workaround
- Reviewed both map pickers (`AddressPicker.tsx`, `admin/Restaurant.tsx`) on 2026-10-25: both read coordinates from Leaflet's authoritative `marker.getLatLng()` in the `dragend` handler, so no stale-state snap was found.
- Could not reproduce on desktop or mobile emulation. Marked **Won't Fix** pending a reproducible device/browser report.

### Related CHANGELOG Entry
`2026-10-25 | AI Agent (OpenCode) | docs | .bug-reports/BUG_LOG.md | ...`

### Verified On
2026-10-25 — code review; Leaflet `dragend` coordinates are read from the marker itself.

---

## BUG-003: Socket reconnection doesn't re-join tracking room automatically

- **Severity:** Medium
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-18
- **Affected Files:** `client/src/lib/socket.ts` (or wherever socket client initialized), `client/src/components/LiveTracking.tsx`, `server/socketHandlers/trackingSocket.ts`
- **Environment:** Both
- **Browser/Device:** All

### Description
If the Socket.IO connection drops (network hiccup, backend restart, Render free tier wake-up), the client reconnects but **does not re-join the order tracking room**. Live tracking stops updating until manual page refresh.

### Reproduction Steps
1. Start an order, progress to "On the Way" status
2. Open LiveTracking page — confirm live updates working
3. Simulate disconnect: stop backend server (`Ctrl+C`) or disable network briefly
4. Restart backend / re-enable network
5. Observe: socket reconnects (console shows `connect`), but no position updates resume
6. Manual refresh fixes it

### Expected Behavior
Auto-rejoin the `order:{orderId}` room on reconnection; resume tracking seamlessly.

### Actual Behavior
Socket reconnects but room membership lost; server doesn't send updates to stale socket ID.

### Root Cause
Client-side socket logic joins room only on initial mount (`useEffect` with `orderId` dependency). Reconnection doesn't trigger re-join.

### Fix / Workaround
- Verified in `client/src/components/LiveTracking.tsx`: the socket's `connect` handler (not just the mount effect) emits `customer:join` with the current `orderId`, so every reconnect re-joins the room automatically.
- Server handler is idempotent (`socket.join`) and re-validates order ownership.

### Related CHANGELOG Entry
`2026-10-25 | AI Agent (OpenCode) | docs | .bug-reports/BUG_LOG.md | ...`

### Verified On
2026-10-25 — reconnection path covered by `server/tests/tracking.test.ts` room-join tests.

---

## BUG-004: Stripe webhook fails silently if `WEBHOOK_ENDPOINT_SECRET` missing

- **Severity:** Low (but High impact if deployed without it)
- **Type:** Logic / Security
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-18
- **Affected Files:** `server/controller/order.controller.ts` (webhook handler), `server/routes/order.route.ts`
- **Environment:** Production (if misconfigured)
- **Browser/Device:** N/A (server-side)

### Description
If `WEBHOOK_ENDPOINT_SECRET` is not set in production environment variables, the Stripe webhook handler crashes or returns 400/500 silently — orders paid via Stripe never move to `confirmed`, and failed payments never marked `payment_failed`. No alerting.

### Reproduction Steps
1. Deploy backend without `WEBHOOK_ENDPOINT_SECRET` set
2. Complete a Stripe Checkout payment
3. Stripe sends `checkout.session.completed` webhook
4. Webhook handler throws/returns error → order stays `pending`
5. No logs/alerts unless manually checking Render logs

### Expected Behavior
- At startup, validate `WEBHOOK_ENDPOINT_SECRET` exists in production; crash early with clear message
- Webhook returns 400 with descriptive error if signature verification fails
- Monitoring/alerting on webhook failures

### Actual Behavior
Silent failure — order stuck in `pending`, no user notification, no admin visibility.

### Root Cause
No startup validation for required webhook secret; error handling in webhook controller may swallow/strip error details.

### Fix / Workaround
- **Fixed (2026-10-25):** `server/index.ts` validates every required env var at startup (including `WEBHOOK_ENDPOINT_SECRET`) and exits with a clear message if any are missing.
- Webhook handler logs signature failures and returns a descriptive `400`, and logs processing failures for monitoring.

### Related CHANGELOG Entry
`2026-10-25 | AI Agent (OpenCode) | fix | server/index.ts | ...`

### Verified On
2026-10-25 — startup guard reviewed; webhook signature tests in `server/tests/order.test.ts` pass.

---

## BUG-005: Environment variables not loaded before modules read `process.env`

- **Severity:** Critical
- **Type:** Logic / Config
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/index.ts`, `server/config/env.ts`, `server/services/mapService.ts`, `server/controller/order.controller.ts`, `server/db/connectDB.ts`
- **Environment:** Both

### Description
Modules that read `process.env` at import time (map service, Stripe client, DB connector) were evaluated before `dotenv.config()` ran, so `MONGO_URI`, `OPENCAGE_API_KEY`, Stripe keys and `SECRET_KEY` were `undefined` during startup.

### Root Cause
`dotenv.config()` was called inside `index.ts` after static imports had already been evaluated.

### Fix / Workaround
Added `server/config/env.ts` as a side-effect module that resolves `server/.env` with `import.meta.url` (works from source and `dist/`) and is imported first in `server/index.ts`.

### Verified On
2026-10-25 — server boots with env-dependent modules initialized; `tsc --noEmit` passes.

---

## BUG-006: Every route-param validation rejected valid requests

- **Severity:** Critical
- **Type:** Logic / API
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/schemas/validation.ts`, `server/routes/order.route.ts`, `server/routes/menu.route.ts`, `server/routes/restaurant.route.ts`, `server/routes/review.route.ts`, `server/routes/map.route.ts`
- **Environment:** Both

### Description
Routes validated `req.params` (an object such as `{ orderId }`) with a bare `z.string()` schema. Zod therefore always failed and returned `400 Validation failed` for `GET /order/:orderId`, `GET /order/session/:sessionId`, menu/restaurant/review `/:id`, and `/map/pincode/:pincode`.

### Root Cause
Scalar schemas were passed to `validate(schema, "params")`, but `validate()` parses the whole params object.

### Fix / Workaround
Added object param schemas (`idParamSchema`, `orderIdParamSchema`, `restaurantIdParamSchema`, `pincodeParamSchema`, `stripeSessionIdParamSchema`) and switched every route to them.

### Verified On
2026-10-25 — `server/tests/order.test.ts`, `map.test.ts`, and `review.test.ts` cover these routes (all pass).

---

## BUG-007: Review controller crashed on a missing `Order` import

- **Severity:** Critical
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/controller/review.controller.ts`
- **Environment:** Both

### Description
`addReview` enforces the "must have a delivered order" rule with `Order.findOne(...)`, but `Order` was never imported, so every review submission threw a `ReferenceError` and returned `500`.

### Fix / Workaround
Imported `Order` from `../models/order.model.js`.

### Verified On
2026-10-25 — `server/tests/review.test.ts` (add-review suite) passes.

---

## BUG-008: Owners with multiple restaurants saw no/wrong orders

- **Severity:** High
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/controller/restaurant.controller.ts`, `server/controller/menu.controller.ts`
- **Environment:** Both

### Description
Owner order/menu queries used `Restaurant.findOne({ user: req.id })`, so only the first restaurant was considered. Orders and menus for the owner's other restaurants were invisible, and menu edit/delete ownership was checked against the wrong restaurant.

### Fix / Workaround
- Order queries now use `Restaurant.find({ user: req.id }).distinct("_id")` / `$in` scoping.
- Menu edit/delete verifies ownership against `menu.restaurant`.
- Added optional `?restaurantId=` selection and `Restaurant.exists({ _id, user: req.id })` ownership checks.

### Verified On
2026-10-25 — server compiles; multi-restaurant paths reviewed and covered by ownership checks.

---

## BUG-009: Restaurant/menu multipart forms always failed validation

- **Severity:** High
- **Type:** Logic / API
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/schemas/validation.ts`
- **Environment:** Both

### Description
`FormData` sends every field as a string. Zod expected numbers for `deliveryTime`, `deliveryPrice`, `lat`, `lng`, `price`, and an array for `cuisines`, so creating or editing a restaurant/menu from the browser failed with `400`.

### Fix / Workaround
- Numeric fields use `z.coerce.number()`.
- `cuisines` is preprocessed: JSON-decoded when it is a FormData string, passed through when it is already an array.

### Verified On
2026-10-25 — `tsc --noEmit` passes; schema behavior covered by manual payload review.

---

## BUG-010: ObjectId heuristic rejected valid 6-digit pincodes

- **Severity:** High
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/middlewares/validate.ts`
- **Environment:** Both

### Description
The param validator treated any hex-looking value with length ≠ 24 as a malformed ObjectId. A 6-digit pincode (`700001`) is hex-looking, so `/api/v1/map/pincode/700001` returned `400`.

### Fix / Workaround
The heuristic now runs only for param keys matching `/(Id|_id)$/`; real validation is delegated to the route's Zod schema.

### Verified On
2026-10-25 — pincode tests in `server/tests/map.test.ts` pass.

---

## BUG-011: `GET /order/session/:sessionId` was shadowed by `GET /order/:orderId`

- **Severity:** High
- **Type:** Logic / Routing
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/routes/order.route.ts`
- **Environment:** Both

### Description
The dynamic `/:orderId` route was registered first, so `session` was captured as an order ID and always failed validation. Stripe redirects could never resolve their order.

### Fix / Workaround
Moved `/session/:sessionId` above `/:orderId` and validated it with a Stripe-specific schema (`cs_test_…` / `cs_live_…`).

### Verified On
2026-10-25 — route ordering reviewed; client `Success.tsx` session lookup now works.

---

## BUG-012: Cart could mix restaurants, charging the wrong delivery fee

- **Severity:** High
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/components/CheckoutConfirmPage.tsx`, `client/src/components/AvailableMenu.tsx`, `client/src/store/useCartStore.ts`
- **Environment:** Both

### Description
The cart restaurant was taken from a global "single restaurant" store instead of the actual cart items. Adding items from another restaurant could silently reuse the old restaurant ID and delivery fee at checkout.

### Fix / Workaround
- Cart items now carry `menu.restaurant`.
- Checkout derives `cartRestaurantId` from the cart and only falls back to the store when IDs match.
- Mixed-restaurant carts are blocked with a clear UI warning before payment.

### Verified On
2026-10-25 — client `tsc -b` passes; mixed-cart guard reviewed.

---

## BUG-013: Success page cleared the cart before payment was confirmed

- **Severity:** High
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/components/Success.tsx`, `client/src/store/useOrderStore.ts`, `server/controller/order.controller.ts`
- **Environment:** Both

### Description
The success page ignored Stripe's `session_id`, showed placeholder order data, and cleared the cart immediately — including after failed/cancelled payments.

### Fix / Workaround
- Reads `session_id`, resolves the order via `getOrderBySessionId`, and falls back to `getOrderById` for COD.
- Clears the cart only after a paid/confirmed status.
- Shows pending/failed states, retry and track buttons.
- `getOrderById` now upserts the order into the store.

### Verified On
2026-10-25 — client `tsc -b` passes; success/failure paths reviewed.

---

## BUG-014: Infinite request loop in `DeliveryTimeEstimator`

- **Severity:** High
- **Type:** Performance / Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/components/DeliveryTimeEstimator.tsx`
- **Environment:** Both

### Description
The effect depended on an address object that was recreated on every render, causing an endless loop of delivery-time requests.

### Fix / Workaround
Depend on primitive `customerAddress`/`customerPincode`, abort stale requests with `AbortController`, and reset state when inputs become invalid.

### Verified On
2026-10-25 — dependency graph reviewed; `tsc -b` passes.

---

## BUG-015: Admin "Add Menu" never linked items to the restaurant

- **Severity:** High
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/admin/AddMenu.tsx`, `server/schemas/validation.ts`, `server/controller/menu.controller.ts`
- **Environment:** Both

### Description
`AddMenu` did not send a `restaurantId`, so multi-restaurant owners got `400` or menus attached to whichever restaurant the server guessed. The add action was also usable before any restaurant loaded.

### Fix / Workaround
- Load the owner's restaurant on mount and append `restaurantId` to `FormData`.
- `addMenuSchema.restaurantId` is optional for single-restaurant owners; the controller resolves the owner's restaurant when omitted.
- Added loading/no-restaurant states and disabled the action without a restaurant.

### Verified On
2026-10-25 — client `tsc -b` and server `tsc --noEmit` pass.

---

## BUG-016: Duplicate Stripe webhooks incremented `orderCount` twice

- **Severity:** High
- **Type:** Logic / Data integrity
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/controller/order.controller.ts`
- **Environment:** Production

### Description
Webhook idempotency relied only on `order.status === "pending"`. Stripe retries and non-critical event paths could re-enter processing before the event was recorded, double-counting `Menu.orderCount` and re-saving orders.

### Fix / Workaround
Record every handled event in `processedWebhookEvents` (with a 24 h TTL cleanup) and short-circuit duplicates before touching the database. Status remains a second guard.

### Verified On
2026-10-25 — webhook idempotency test in `server/tests/order.test.ts` passes.

---

## BUG-017: Checkout/webhook transactions fail on standalone MongoDB

- **Severity:** Medium
- **Type:** Testing / Infrastructure
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/tests/setup.ts`, `server/vitest.config.ts`
- **Environment:** Test

### Description
COD checkout and the Stripe webhook use MongoDB transactions. `MongoMemoryServer` starts a standalone `mongod`, which throws `Transaction numbers are only allowed on a replica set member or mongos`.

### Fix / Workaround
Tests now start `MongoMemoryReplSet` (single node, wiredTiger) and reuse an installed `mongod` binary when present, avoiding a 700 MB download. `hookTimeout` raised to 180 s.

### Verified On
2026-10-25 — full suite runs locally without a network download.

---

## BUG-018: Direct tracking links rendered a blank/incorrect page

- **Severity:** Medium
- **Type:** Logic / UI
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/App.tsx`, `client/src/components/LiveTracking.tsx`
- **Environment:** Both

### Description
Opening `/track/:orderId` directly (refresh, shared link) found no order in the Zustand store, so tracking rendered nothing or stale data. The status was also hard-coded.

### Fix / Workaround
- `LiveTrackingPage` fetches a missing order via `getOrderById`.
- Added loading, not-found, and missing-address states.
- Passes the real `initialStatus`, and `LiveTracking` syncs it when props change.

### Verified On
2026-10-25 — client `tsc -b` passes; deep-link paths reviewed.

---

## BUG-019: AddressPicker leaked its map and sent stale autocomplete requests

- **Severity:** Medium
- **Type:** Performance / UI
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/components/AddressPicker.tsx`
- **Environment:** Both

### Description
The Leaflet map was never destroyed on unmount, typing fired one geocode request per keystroke, and selecting a suggestion discarded `city`/`state`/`country`.

### Fix / Workaround
- Map instance cleanup on unmount.
- 300 ms debounced autocomplete with timer cleanup.
- Initial address/pincode sync; errors cleared after a successful location/suggestion.
- Callback now includes optional `city`, `state`, `country`.

### Verified On
2026-10-25 — client `tsc -b` passes.

---

## BUG-020: Profile `state` was dropped and location auto-fill duplicated

- **Severity:** Medium
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/components/Profile.tsx`, `server/models/user.model.ts`, `server/controller/user.controller.ts`, `server/schemas/validation.ts`
- **Environment:** Both

### Description
The profile form collected a state but it was never sent or persisted, the auto-location effect ran twice, and a success toast appeared even when the update failed.

### Fix / Workaround
Added `state` to the user model, update schema, controller, and form payload; deduplicated the location effect; only show success after a successful response; added image fallback.

### Verified On
2026-10-25 — auth/profile tests pass; `tsc` passes on both sides.

---

## BUG-021: Rate limiter triggered `ERR_ERL_KEY_GEN_IPV6` and could be bypassed

- **Severity:** Medium
- **Type:** Security
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/middlewares/rateLimit.ts`
- **Environment:** Production

### Description
A custom `keyGenerator` returned `req.ip` directly. express-rate-limit v8 flags this (`ERR_ERL_KEY_GEN_IPV6`) and IPv6 clients could rotate addresses within their /64 to bypass limits.

### Fix / Workaround
Removed the custom key generator so the library's default IP/IPv6-subnet keying is used. Rate limiting is skipped only for `/health` and `NODE_ENV=test`.

### Verified On
2026-10-25 — warning no longer appears during tests; rate-limit behavior reviewed.

---

## BUG-022: `req.ip` was the proxy address, breaking per-IP limits

- **Severity:** Medium
- **Type:** Security
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/index.ts`
- **Environment:** Production (Render/Vercel)

### Description
Without `trust proxy`, every request behind the hosting proxy appeared to come from the proxy, so all users shared one rate-limit bucket.

### Fix / Workaround
Added `app.set("trust proxy", 1)`.

### Verified On
2026-10-25 — configuration reviewed for single-proxy deployments.

---

## BUG-023: `deliveryDetails.pincode` and `user.state` were silently dropped

- **Severity:** Medium
- **Type:** Logic / Data integrity
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/models/order.model.ts`, `server/models/user.model.ts`, `server/schemas/validation.ts`
- **Environment:** Both

### Description
`pincode` was accepted by checkout but not declared in the order schema, so it was never stored (and address validation could not be audited). `state` had the same problem on the user model.

### Fix / Workaround
Added `pincode` to `deliveryDetails` (validated 6 digits, default `""` for legacy/COD payloads) and `state` to the user schema plus update validation.

### Verified On
2026-10-25 — order/review/auth tests pass.

---

## BUG-024: Menu items priced at ₹0 were rejected

- **Severity:** Medium
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/controller/menu.controller.ts`, `server/schemas/validation.ts`
- **Environment:** Both

### Description
Truthiness checks (`if (!price)`) treated a legitimate `0` price (free item/promo) as missing and returned `400`.

### Fix / Workaround
Use `price === undefined` checks; schema allows `min(0)`.

### Verified On
2026-10-25 — server compiles; schema reviewed.

---

## BUG-025: Feature cards used invalid Tailwind classes / inline colors

- **Severity:** Low
- **Type:** UI/UX
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/components/FeaturedMenus.tsx`
- **Environment:** Both

### Description
A dynamic Tailwind class expression and invalid inline `background` values meant some dish cards rendered without their intended gradient/border styling.

### Fix / Workaround
Cards now receive explicit `text`/`gradient` theme props with static classes and valid gradient values.

### Verified On
2026-10-25 — client `tsc -b` passes; classes are statically analyzable by Tailwind.

---

## BUG-026: All image placeholders pointed at a dead domain

- **Severity:** Low
- **Type:** UI/UX
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/lib/placeholder.ts`, `client/src/components/AvailableMenu.tsx`, `RestaurantDetail.tsx`, `Profile.tsx`, `FeaturedMenus.tsx`, `admin/AddMenu.tsx`, `admin/EditMenu.tsx`
- **Environment:** Both

### Description
Fallbacks used `via.placeholder.com`, which is unreachable, so broken images showed a broken-image icon.

### Fix / Workaround
Added a shared inline SVG data-URI fallback (`FALLBACK_IMAGE`, `getImageUrl`, `handleImageError`) and used it everywhere.

### Verified On
2026-10-25 — client `tsc -b` passes.

---

## BUG-027: Edit Menu could crash when no menu was selected

- **Severity:** Low
- **Type:** Logic
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/admin/EditMenu.tsx`
- **Environment:** Both

### Description
The component dereferenced `selectedMenu._id` unconditionally, throwing on direct navigation or after a refresh.

### Fix / Workaround
Guard the missing menu, show a safe empty state, and use the shared image fallback.

### Verified On
2026-10-25 — client `tsc -b` passes.

---

## BUG-028: Test suite could not start (5 failing suites)

- **Severity:** Medium
- **Type:** Testing / Tooling
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/tests/setup.ts`, `server/tests/order.test.ts`, `server/tests/map.test.ts`, `server/tests/review.test.ts`, `server/tests/tracking.test.ts`
- **Environment:** Test

### Description
Tests were blocked by: a 700 MB `mongodb-memory-server` download timeout, a Stripe mock that was not constructible (`new Stripe()` threw), a missing `mongoose` import in `map.test.ts`, `socket.io` imported as a namespace instead of the `Server` class, deprecated `done()` callbacks, a webhook route that was not registered in the test app, and review tests that predated the "delivered order required" rule.

### Fix / Workaround
- Reuse an installed `mongod`; start a single-node replica set.
- Constructible Stripe class mock with signature verification.
- Fixed imports, converted socket tests to promises with deterministic cleanup.
- Registered the raw-body webhook route in the test app (mirrors production).
- Created delivered orders for review fixtures.
- Added `npm test` / `npm run test:watch`.

### Verified On
2026-10-25 — **5/5 suites, 71/71 tests pass**.

---

## BUG-029: Invalid `client/package.json` dependency and stray backend types

- **Severity:** Low
- **Type:** Config / Dependencies
- **Status:** Verified
- **Reported By:** AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `client/package.json`
- **Environment:** Both

### Description
The client declared `"server": "file:.."` (the repo root has no `package.json`) and included backend-only `@types/*` packages, causing noisy installs and resolution confusion.

### Fix / Workaround
Removed the invalid file dependency and backend-only type packages; kept `@types/node`.

### Verified On
2026-10-25 — client `npm install`/`tsc -b` succeeds.

---

## BUG-030: Restaurant details/reviews returned 400 from a stale backend build

- **Severity:** High
- **Type:** Regression / Logic
- **Status:** Verified
- **Reported By:** User report, diagnosed by AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/package.json`, `client/src/lib/validation.ts`, `client/src/store/useRestaurantStore.ts`, `client/src/store/useReviewStore.ts`, `client/src/components/FeaturedMenus.tsx`, `client/src/components/RestaurantDetail.tsx`, `client/src/components/LiveTracking.tsx`, `client/src/types/restaurantType.ts`, `server/tests/restaurant.test.ts`
- **Environment:** Local
- **Browser/Device:** Chrome, desktop

### Description
Clicking a dish on the home page navigated to `/restaurant/:id`, but both `GET /api/v1/restaurant/:id` and `GET /api/v1/review/restaurant/:id` returned `400 Validation failed` with `": Invalid input: expected string, received object"`. The UI then stayed on the loading skeleton forever.

### Reproduction Steps
1. Run the backend with `node dist/index.js` from an older build.
2. Open the home page and click any dish card.
3. Observe the 400 responses and the invalid-restaurant-ID toast.
4. The detail page never resolves because `loading || !singleRestaurant` always rendered the skeleton.

### Root Cause
- The running `dist` build predated the param-validation fix and still validated `req.params` with a bare ObjectId string schema instead of an object schema (`{ id }` / `{ restaurantId }`). A fresh build and the TypeScript source were already correct.
- The client fell back to any 24-character value and showed an endless skeleton on failure, hiding the real error. It also had no protection against out-of-order responses when navigating between restaurants.

### Fix / Workaround
- `npm start` now rebuilds before launching `dist/index.js`, preventing a stale compiled server from being served.
- Added strict 24-character hexadecimal ObjectId checks on the client and skip API calls for malformed IDs.
- Restaurant/review stores now dedupe in-flight requests (React StrictMode) and ignore stale responses.
- `RestaurantDetail` now shows an explicit "Restaurant unavailable" state with retry/browse actions instead of an endless skeleton.
- Home dish cards only build detail links from a valid restaurant ObjectId.
- Socket.IO no longer forces WebSocket before polling, removing the "closed before the connection is established" warning on StrictMode double mounts.

### Related CHANGELOG Entry
`2026-10-25 | AI Agent (OpenCode) | fix | ... | Fixed restaurant detail/review 400 loop ...`

### Verified On
2026-10-25 — fresh backend: existing ID → 200, malformed ID → 400, valid-but-missing ID → 404 (restaurant) and 200 empty reviews; `server` 77/77 tests and `client` production build pass.

---

## BUG-031: Owner dashboard restaurant/menu/order requests all returned 400

- **Severity:** High
- **Type:** Regression / Configuration
- **Status:** Verified
- **Reported By:** User report, diagnosed by AI Agent (OpenCode)
- **Reported On:** 2026-10-25
- **Affected Files:** `server/nodemon.json`, `server/tests/dashboard.test.ts`, `server/dist/` (rebuilt), `client/src/admin/Restaurant.tsx`, `client/src/admin/AddMenu.tsx`, `client/src/admin/EditMenu.tsx`, `client/src/admin/Orders.tsx`
- **Environment:** Local
- **Browser/Device:** Chrome, desktop

### Description
Every action in the owner dashboard failed with `400 Validation failed` and `": Invalid input: expected string, received object"`:
- loading the dashboard restaurant (`GET /restaurant/`)
- updating the restaurant (`PUT /restaurant/:id`)
- loading/editing menus (`GET /menu/restaurant/:restaurantId`, `PUT /menu/:id`)
- listing orders (`GET /restaurant/order`)
- changing an order status (`PUT /restaurant/order/:orderId/status`)

### Reproduction Steps
1. Start the backend with `node dist/index.js` from a build created before the param-schema fix.
2. Log in as a restaurant owner and open Dashboard → Restaurant / Menu / Orders.
3. Observe 400 responses and error toasts on every dashboard request.
4. Restart the backend from current source or a fresh `npm run build`; the same requests return 200.

### Root Cause
- The process listening on port 8001 was `node dist/index.js`, started **before** the ObjectId param-schema fix was compiled. Node keeps loaded modules in memory, so it continued validating `req.params` with the old bare-string schema even though `dist` on disk had already been rebuilt.
- `server/nodemon.json` only watched routes/controllers/models/middlewares/utils/db. It did **not** watch `schemas/`, `config/`, `services/`, or `socketHandlers/`, so a dev server could also keep stale validation code after edits to `server/schemas/validation.ts`.

### Fix / Workaround
- Restarted the backend from current source (and rebuilt `server/dist`) — all dashboard endpoints immediately returned 200.
- Expanded `nodemon.json` watch paths to every server source directory, including `schemas`, `config`, `services`, and `socketHandlers`.
- Added `server/tests/dashboard.test.ts` (10 tests) covering owner restaurant load, restaurant update, menu-by-restaurant listing, menu edit, order listing, status transitions, cross-owner authorization, and malformed-ID handling.

### Related CHANGELOG Entry
`2026-10-25 | AI Agent (OpenCode) | fix | ... | Restored owner dashboard restaurant/menu/order flow ...`

### Verified On
2026-10-25 — manual multipart flow: create restaurant → add menu → edit/delete menu → update restaurant (with/without image) → list orders → advance status, all 200; `server` 7/7 suites, 87/87 tests; `server` `tsc --noEmit`; `client` `tsc -b && vite build` pass.

---

## BUG-032: Maps and live tracking used stale location data

- **Severity:** High
- **Type:** Logic
- **Status:** Verified
- **Reported By:** User
- **Reported On:** 2026-10-25
- **Affected Files:** `client/src/components/AddressPicker.tsx`, `client/src/components/CheckoutConfirmPage.tsx`, `client/src/components/DeliveryTimeEstimator.tsx`, `client/src/components/LiveTracking.tsx`, `client/src/App.tsx`, `client/src/admin/Restaurant.tsx`, `client/src/store/useOrderStore.ts`, `client/src/types/orderType.ts`, `server/routes/map.route.ts`, `server/schemas/validation.ts`, `server/models/order.model.ts`, `server/socketHandlers/trackingSocket.ts`
- **Environment:** Both
- **Browser/Device:** All browsers

### Description
Restaurant, customer-address, and order-tracking maps could display or submit old locations: the pin chosen on the map was discarded in favour of a text geocode, checkout reused `localStorage.selectedAddress` indefinitely, edited addresses kept old lat/lng, the tracking map never reacted to refreshed order data, and a reloaded tracking page showed the driver at the restaurant until the next GPS event. Deployed builds also fell back to `http://localhost:8001` for Socket.IO when `VITE_SOCKET_URL` was unset.

### Reproduction Steps
1. Open the address picker, choose an address from autocomplete, then move the pin to a different spot and confirm.
2. Complete checkout, then edit the address/pincode and place another order.
3. Open `/track-order/:orderId`, then refresh the page while the driver is moving.
4. In a production build without `VITE_SOCKET_URL`, observe Socket.IO trying to connect to localhost.

### Expected Behavior
The exact pin/GPS position is authoritative; checkout never pairs a new address with old coordinates; the tracking map shows the latest persisted driver position immediately and reacts to refreshed order data; production uses the API origin for Socket.IO unless explicitly configured.

### Actual Behavior
The submitted coordinates came from geocoding the typed address, stale cache values were reused, and the tracking map ignored prop updates / defaulted to the restaurant and localhost socket.

### Root Cause
- `AddressPicker` sent only address text on validate and never placed/sent the selected marker; the map always started at a hard-coded Kolkata centre.
- `CheckoutConfirmPage` loaded `selectedAddress` forever and did not clear it when the address/pincode was edited; the manual form had no pincode field.
- `/map/validate-address` and `/map/check-delivery` had no optional coordinates and always geocoded text.
- `LiveTracking` created its Leaflet map in an empty-dependency effect, defaulted the driver marker to the restaurant, and had no snapshot/poll fallback. The server only stored periodic `trackingHistory` entries, not the current driver position, and `customer:join` emitted nothing.
- `Restaurant.tsx` reverse-geocoded the saved restaurant on initial load, overwriting saved pincode/city/country; geolocation allowed cached fixes (`maximumAge` unset).

### Fix / Workaround
- Added optional `lat`/`lng` to map validation/delivery schemas; the server now treats them as authoritative, derives the formatted address by reverse-geocoding the pin, and only geocodes text when no pin is supplied.
- `AddressPicker` now initializes from saved coordinates/address, places a draggable marker, uses the selected pin/GPS position on submit, returns structured city/state/country, clears stale pincode metadata when the pin moves, and does not submit the parent profile form.
- Checkout now stores `savedAt` with a 7-day TTL, drops legacy entries, clears stale coordinates when the address/pincode changes, resolves the current address on every submit, and includes a manual pincode field.
- `DeliveryTimeEstimator` sends the selected pin coordinates.
- Orders now persist `driverLocation`/`driverLocationUpdatedAt` on every accepted driver update; `customer:join` immediately sends a `tracking:snapshot`.
- `LiveTracking` reacts to refreshed props, uses the last persisted position, fits bounds even when routing fails, ignores older polled positions, handles snapshots/live updates with timestamps, and derives the socket URL from the API origin instead of localhost.
- `LiveTrackingPage` always fetches a fresh order before rendering, and polls every 10 seconds as a fallback when Socket.IO is unavailable.
- Restaurant map loading no longer overwrites saved address fields and GPS requests use `maximumAge: 0`.

### Related CHANGELOG Entry
`2026-10-26 | AI Agent (OpenCode) | fix | ... | Fixed stale restaurant/address/live-tracking map data ...`

### Verified On
2026-10-26 — `server` 7/7 suites, 90/90 tests; `server` `tsc --noEmit`; `client` `tsc -b && vite build`. Live API: pin `(22.6, 88.5)` returned `coordinates [88.5,22.6]`, `source: "map-pin"`, and a pin-reverse-geocoded formatted address; live `/map/check-delivery` with pin coordinates returned 200 (1.51 km, 5 min).

---

## BUG-033: Remaining `/restaurant/undefined` links still caused 400s

- **Severity:** High
- **Type:** Logic / Validation
- **Status:** Verified
- **Reported By:** User report, diagnosed by AI Agent (OpenCode)
- **Reported On:** 2026-10-26
- **Affected Files:** `client/src/components/SearchPage.tsx`, `client/src/components/MyOrders.tsx`, `client/src/components/RestaurantDetail.tsx`, `client/src/components/LiveTracking.tsx`, `client/src/lib/validation.ts`, `client/src/store/useReviewStore.ts`, `client/src/store/useRestaurantStore.ts`, `server/utils/objectId.ts`, `server/controller/restaurant.controller.ts`, `server/controller/review.controller.ts`, `server/tests/restaurant.test.ts`, `server/tests/dashboard.test.ts`
- **Environment:** Local
- **Browser/Device:** Chrome, desktop

### Description
After the earlier ObjectId fixes, two paths could still produce an invalid detail URL:
- `SearchPage` built `to={/restaurant/${restaurant._id}}` without checking `_id`.
- `MyOrders` used `order.restaurant._id` (or a raw string) without validating it.

If the field was missing, React Router navigated to `/restaurant/undefined`. Both `GET /api/v1/restaurant/undefined` and `GET /api/v1/review/restaurant/undefined` returned `400`, and the toast "The requested restaurant ID is invalid." appeared. Separately, dev builds logged `WebSocket ... closed before the connection is established` because React StrictMode mounted/cleaned up the tracking socket before its handshake finished.

### Reproduction Steps
1. Load a restaurant/order payload where the restaurant reference is absent or not an ObjectId.
2. Click "View Menu" on a search card or "Reorder" on an order.
3. Observe navigation to `/restaurant/undefined`, two 400 responses, and the invalid-ID toast.
4. Open `/track-order/:orderId` in development with React StrictMode enabled and watch the console during the first mount.

### Expected Behavior
No link is ever generated from an invalid id. Malformed ids are rejected before any request; valid-but-missing ids show a 404-style state. The tracking socket only opens once, after React has settled its StrictMode mount cycle.

### Root Cause
- Only some call sites used the shared `getRestaurantId()` helper; search cards and order reorder links did not.
- `singleRestaurant` was persisted in localStorage, so stale detail data could render on a fresh deep link.
- Review fetch failures were swallowed and displayed as "No reviews yet".
- `mongoose.Types.ObjectId.isValid` (used in controllers) also accepts 12-byte strings, so malformed-but-castable values could bypass the intended 400 path when the route validator was not involved.
- The socket connected synchronously inside the effect; StrictMode’s throw-away first mount disconnected it mid-handshake.

### Fix / Workaround
- All restaurant detail links now resolve through `getRestaurantId()`; invalid values render a disabled control instead of navigating.
- Removed the stale-render hazard: the detail page only uses a persisted `singleRestaurant` when its id matches the URL (the persisted copy is still available for checkout totals after a refresh).
- Added `reviewsError` to the review store and loading/error/retry states in `RestaurantDetail`.
- Added `server/utils/objectId.ts` with a strict 24-hex check and applied it to restaurant/review/order params; regression tests cover 12-byte values on both the path and query forms.
- Tracking socket uses `autoConnect: false` and connects on a deferred tick; the StrictMode first mount is cleaned up before any connection starts.

### Related CHANGELOG Entry
`2026-10-26 | AI Agent (OpenCode) | fix | ... | Permanent fix for invalid restaurant/review IDs and Socket.IO handshake warning ...`

### Verified On
2026-10-26 — `server` 7/7 suites, 92/92 tests; `server` `npm run build`; `client` `tsc -b && vite build`. API matrix: existing id → 200, malformed id → 400, 12-byte id → 400, valid-but-missing id → 404 (restaurant) and 200 with empty reviews.

---

## BUG-034: Checkout failed on standalone MongoDB — FIXED
- **Fixed On:** 2026-10-26
- **Fixed By:** AI Agent (OpenCode)
- **Severity:** Critical
- **Affected Files:** `server/utils/transactions.ts`, `server/controller/order.controller.ts`, `server/db/connectDB.ts`, `server/index.ts`, `server/scripts/start-local-mongo.ps1`, `server/scripts/ensure-local-mongo.mjs`, `server/scripts/migrate-local-mongo.mjs`, `start-dev.bat`, `quick-start.bat`, `server/.env.example`
- **Environment:** Local Windows laptop, MongoDB 8.3.2 installed as a Windows service
- **CHANGELOG:** `2026-10-26 | AI Agent (OpenCode) | fix | Standalone-MongoDB checkout + duplicate port`

### Description
`POST /api/v1/order/checkout/create-checkout-session` returned HTTP 500 for Cash on Delivery orders with:

```
MongoServerError: Transaction numbers are only allowed on a replica set member or mongos
code: 20
codeName: "IllegalOperation"
```

Login, restaurant, menu, map, and delivery-validation requests still returned 200, so the failure was isolated to the checkout transaction.

### Root Cause
The local MongoDB service was running as a standalone `mongod` (`replSet` commented out in `mongod.cfg`). COD checkout and webhook confirmation used `mongoose.startSession()` + `startTransaction()`, which standalone servers cannot execute.

### Fix / Workaround
- Added a user-space single-node replica set on port `27018` (`npm run mongo:start`, no admin rights) and migrated the existing `suman_food` data into it. `.env` now uses `...?replicaSet=rs0`.
- Added `server/utils/transactions.ts`. It probes the connected deployment (`hello.setName`/`msg: "isdbgrid"`) and runs callbacks inside `session.withTransaction()` when supported.
- On standalone MongoDB, checkout uses compensating writes: a COD failure deletes the just-created order and decrements menu counters; a webhook failure restores the previous order fields and decrements menu counters. No transaction code was removed.
- `/health` now exposes `transactions: { supported, topology }`, and startup logs a clear warning for standalone deployments.
- Production Atlas (`mongodb+srv`) continues to use real transactions.

### Verified On
2026-10-26 — `server` 7/7 suites, 92/92 tests; `tsc --noEmit`; live COD checkout on replica set returned 200 and persisted a `confirmed` order with `orderCount + 1`; live COD checkout against standalone `27017` (temporary port `8002`) also returned 200 through the fallback; both smoke-test orders were deleted.

---

## BUG-035: Duplicate backend starts caused EADDRINUSE and killed unrelated processes — FIXED
- **Fixed On:** 2026-10-26
- **Fixed By:** AI Agent (OpenCode)
- **Severity:** Medium
- **Affected Files:** `server/package.json`, `server/scripts/ensure-port-free.mjs`, `server/scripts/stop-server.mjs`, `start-dev.bat`, `quick-start.bat`
- **Environment:** Local Windows laptop
- **CHANGELOG:** `2026-10-26 | AI Agent (OpenCode) | fix | Standalone-MongoDB checkout + duplicate port`

### Description
The first backend window showed `Port already in use` while another process continued serving port `8001`. Multiple `npm run dev` / `nodemon` trees were alive. The old `npm run kill` command ran `taskkill /F /IM node.exe`, which killed every Node process on the machine, including Vite and VS Code helpers.

### Root Cause
`start-dev.bat` and `quick-start.bat` launched a new backend without stopping an existing one, and the emergency kill script was not scoped to the backend.

### Fix / Workaround
- `npm run kill` now targets only the process listening on port `8001` and the backend `nodemon` for this repository.
- `predev`/`prestart` run `ensure-port-free.mjs` and exit with instructions if port `8001` is occupied, preventing a second backend and its restart loop.
- `start-dev.bat` and `quick-start.bat` call `npm run kill` before launching the backend.
- Duplicate Vite instance on port `5174` was stopped; one frontend remains on `5173`.

### Verified On
2026-10-26 — `npm run kill` stopped only the backend; port `8001` was free; one backend started successfully and `/health` returned 200 with `database: "connected"`; ports `5173` and `8001` each had one listener.

---

## 📊 Bug Statistics

| Severity | Open | In Progress | Fixed | Verified | Won't Fix | Total |
|----------|------|-------------|-------|----------|-----------|-------|
| Critical | 0 | 0 | 0 | 4 | 0 | 4 |
| High | 0 | 0 | 0 | 13 | 0 | 13 |
| Medium | 0 | 0 | 0 | 11 | 0 | 11 |
| Low | 0 | 0 | 0 | 6 | 1 | 7 |
| **Total** | **0** | **0** | **0** | **34** | **1** | **35** |

---

## 🎉 Bugs Fixed (Historical)

| ID | Title | Severity | Verified |
|----|-------|----------|----------|
| BUG-001 | Dark mode flash on initial load | Low | 2026-10-25 |
| BUG-003 | Socket reconnect did not re-join tracking room | Medium | 2026-10-25 |
| BUG-004 | Webhook silent failure when `WEBHOOK_ENDPOINT_SECRET` missing | Low | 2026-10-25 |
| BUG-005 | Env loaded after modules read `process.env` | Critical | 2026-10-25 |
| BUG-006 | Param validation rejected every request | Critical | 2026-10-25 |
| BUG-007 | Missing `Order` import in review controller | Critical | 2026-10-25 |
| BUG-008 | Multi-restaurant owners saw no/wrong orders | High | 2026-10-25 |
| BUG-009 | Multipart restaurant/menu forms failed validation | High | 2026-10-25 |
| BUG-010 | Pincode rejected by ObjectId heuristic | High | 2026-10-25 |
| BUG-011 | Stripe session route shadowed by order route | High | 2026-10-25 |
| BUG-012 | Mixed-restaurant cart / wrong delivery fee | High | 2026-10-25 |
| BUG-013 | Cart cleared before payment confirmed | High | 2026-10-25 |
| BUG-014 | Infinite delivery-time request loop | High | 2026-10-25 |
| BUG-015 | Add Menu not linked to restaurant | High | 2026-10-25 |
| BUG-016 | Duplicate webhooks double-counted orders | High | 2026-10-25 |
| BUG-017 | Transactions failed on standalone test Mongo | Medium | 2026-10-25 |
| BUG-018 | Direct tracking links blank/incorrect | Medium | 2026-10-25 |
| BUG-019 | AddressPicker leaks / stale autocomplete | Medium | 2026-10-25 |
| BUG-020 | Profile `state` dropped / duplicate effect | Medium | 2026-10-25 |
| BUG-021 | Rate limiter IPv6 validation/bypass | Medium | 2026-10-25 |
| BUG-022 | `trust proxy` missing | Medium | 2026-10-25 |
| BUG-023 | `pincode`/`state` silently dropped | Medium | 2026-10-25 |
| BUG-024 | ₹0 menu price rejected | Medium | 2026-10-25 |
| BUG-025 | Invalid Tailwind classes/inline colors | Low | 2026-10-25 |
| BUG-026 | Dead image placeholder domain | Low | 2026-10-25 |
| BUG-027 | Edit Menu crash without selection | Low | 2026-10-25 |
| BUG-028 | Test suite could not start | Medium | 2026-10-25 |
| BUG-029 | Invalid client dependency / stray types | Low | 2026-10-25 |
| BUG-030 | Restaurant details/reviews returned 400 from stale build | High | 2026-10-25 |
| BUG-031 | Owner dashboard restaurant/menu/order requests returned 400 | High | 2026-10-25 |
| BUG-032 | Maps and live tracking used stale location data | High | 2026-10-26 |
| BUG-033 | Remaining `/restaurant/undefined` links still caused 400s | High | 2026-10-26 |
| BUG-034 | Checkout failed on standalone MongoDB (transaction code 20) | Critical | 2026-10-26 |
| BUG-035 | Duplicate backend starts / unsafe global node kill | Medium | 2026-10-26 |

**Won't Fix:** BUG-002 (mobile marker drag snapping) — not reproducible; coordinates are read from Leaflet's authoritative `getLatLng()` on `dragend`.

```markdown
## BUG-XXX: [Title] — FIXED
- **Fixed On:** YYYY-MM-DD
- **Fixed By:** [Name]
- **CHANGELOG:** [Link]
- **Verification:** [How verified]
```

---

## 💡 Bug Reporting Guidelines

1. **Log immediately** when discovered — don't batch
2. **Assign next available ID** (`BUG-005`, `BUG-006`, etc.)
3. **Be specific** — include exact file paths, line numbers if known
4. **Include reproduction steps** that a stranger could follow
5. **Link to CHANGELOG** when fixed for traceability
6. **Don't delete** — keep history for pattern analysis

---

## 🔗 Cross-References

- `CHANGELOG.md` — all fixes linked here
- `CURRENT_STATE.md` — known issues summary
- `PROJECT_OVERVIEW.md` — high-level known gotchas