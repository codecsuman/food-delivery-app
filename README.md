<div align="center">

# 🍔 Suman Food

### A full-stack food delivery & restaurant management platform built on the MERN stack

<em>Order food, run a restaurant, track deliveries live — all in one app.</em>

<br/>

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit_App-FF4B4B?style=for-the-badge)](https://food-delivery-app-pink-iota.vercel.app)
[![GitHub Repo](https://img.shields.io/badge/⭐_Star_on-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/codecsuman/food-delivery-app)
[![Fork](https://img.shields.io/badge/🍴_Fork-Repository-2ea44f?style=for-the-badge&logo=github)](https://github.com/codecsuman/food-delivery-app/fork)

<br/>

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socket.io&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-626CD9?style=flat-square&logo=stripe&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=flat-square&logo=cloudinary&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)

<br/>

![Stars](https://img.shields.io/github/stars/codecsuman/food-delivery-app?style=social)
![Forks](https://img.shields.io/github/forks/codecsuman/food-delivery-app?style=social)
![Last Commit](https://img.shields.io/github/last-commit/codecsuman/food-delivery-app?style=flat-square&color=blue)
![License](https://img.shields.io/badge/license-ISC-blue.svg?style=flat-square)

</div>

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/Platane/snk/output/github-contribution-grid-snake.svg" width="100%" alt="divider animation"/>
</div>

## 📖 Table of Contents

- [About](#-about)
- [Features](#-features)
- [What's New](#-whats-new)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [How to Use](#-how-to-use)
- [Order Lifecycle](#-order-lifecycle)
- [API Reference](#-api-reference)
- [Roadmap](#-roadmap)
- [Troubleshooting](#-troubleshooting)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

<br/>

## 📝 About

**Suman Food** is a production-ready, full-stack food ordering and restaurant management system. Any user can spin up their own restaurant storefront, drop a pin on a map to set their exact location, manage a menu, and start taking orders — while customers browse, search, checkout with **Stripe or Cash on Delivery**, and watch their order move live on a map from the restaurant to their door.

<div align="center">

| 🌐 Live App | 📦 Repository |
|:---:|:---:|
| [food-delivery-app-pink-iota.vercel.app](https://food-delivery-app-pink-iota.vercel.app) | [github.com/codecsuman/food-delivery-app](https://github.com/codecsuman/food-delivery-app) |

</div>

<br/>

## ✨ Features

<table>
<tr>
<td width="50%">

### 👤 For Customers
- 🔐 Secure signup & login (JWT, HTTP-only cookies)
- 🔎 Real-time restaurant search with debounced input
- 🎛️ Live filters — cuisine, dish/food name, price range & location, pulled straight from the database
- 🛒 Add to cart & checkout with **Stripe or Cash on Delivery**
- ❌ Cancel an order yourself — automatic Stripe refund if it was paid online
- 🗺️ **Live order tracking on a real map** — see the driver move in real time via Socket.IO, with live ETA and remaining distance
- 📦 Animated status progress bar (Placed → Confirmed → Preparing → On the Way → Delivered)
- 🗂️ Active vs Past orders, separated into tabs
- 🔁 Reorder from a past order in one click
- 🌗 Light / Dark mode toggle
- 📱 Fully responsive design

</td>
<td width="50%">

### 🧑‍🍳 For Restaurant Owners
- 🏪 Create & manage your own restaurant
- 📍 **Set your exact location by dragging a pin on a map** (or one-tap "Use My Location") — powers accurate delivery distance and live tracking for your customers
- 📋 Add / edit / delete menu items with images
- 🖼️ Cloudinary-powered image uploads
- 📬 Manage incoming orders live, including COD orders
- 💳 Secure Stripe payment processing with webhook-verified confirmation
- 📊 Full admin dashboard

</td>
</tr>
</table>

<br/>

## 🆕 What's New

This update is a full production-readiness pass — real-time tracking, accurate geolocation, and cross-origin deployment fixes on top of the original checkout flow.

| Area | Before | Now |
|---|---|---|
| **Payment methods** | Stripe only | Stripe **+ Cash on Delivery (COD)**, both correctly include delivery fee |
| **Minimum order amount** | Not enforced | Enforced server-side before Stripe session creation (prevents Stripe's "amount too small" failures) |
| **Order/payment integrity** | Order created before payment | Order created only after Stripe session succeeds, with automatic rollback on any failure — no orphan "pending" orders |
| **Failed payments** | Never updated the order | Stripe webhook correctly matches failed payments back to the order via `PaymentIntent` metadata |
| **Restaurant location** | Not collected — defaulted to `[0, 0]` | Owners set a real location by **dragging a pin on a map** or one-tap geolocation |
| **Live order tracking** | Basic list only | **Real-time map tracking** via Socket.IO — live driver position, ETA, and route, authenticated per order |
| **Cross-origin deployment** | Relative API paths (broke on Vercel) | All API calls use a full backend URL from environment variables |
| **Cross-site auth cookies** | Cookie dropped silently on Vercel ↔ Render | Cookie correctly flagged `Secure` + `SameSite: none` in production, CORS supports multiple explicit origins |
| **Email verification (OTP)** | Present, browser-inconsistent | Removed entirely — signup verifies the account immediately |
| **Cancel order** | ❌ Not possible | ✅ Full flow with automatic Stripe refund |
| **Order tracking (status)** | Basic list | Animated progress bar + Active/Past tabs |
| **Stripe webhook** | ❌ Missing | ✅ Confirms success, flags failed payments |
| **Session recovery** | ❌ Missing | ✅ Order lookup by Stripe `session_id` after redirect |

**Details:**

- **Cash on Delivery (COD)** — `paymentMethod: "cod"` is accepted at checkout. COD orders are created with `status: "confirmed"` immediately, no Stripe session required, and now correctly include the delivery fee in the total (previously only Stripe orders got this).
- **Stripe minimum-amount protection** — orders below `MIN_ORDER_AMOUNT` (default ₹50, configurable via env) are rejected with a clear message *before* a Stripe session is ever created, instead of failing inside Stripe with a cryptic "amount must convert to at least 50 cents" error.
- **No more orphan orders** — line items are validated and built before the order document is created; if Stripe session creation fails for any reason, the order is deleted instead of being left stuck in `pending` forever.
- **Fixed failed-payment tracking** — the `orderId` is now attached directly to the Stripe PaymentIntent's own metadata via `payment_intent_data`, so the `payment_intent.payment_failed` webhook can actually find and update the correct order (previously it searched using the wrong ID field and never matched).
- **Restaurant geolocation** — the restaurant admin form now includes an interactive Leaflet map. Owners drag a marker to their exact location or tap "Use My Location" for instant GPS placement — no manual coordinate entry required. This powers accurate delivery-distance calculation and live tracking maps for customers.
- **Real-time order tracking** — `LiveTracking.tsx` renders a live Leaflet map with restaurant, customer, and driver markers, a live route line, and Socket.IO-powered position updates with ETA and remaining distance — authenticated per order so only the customer (or restaurant owner) can view it.
- **Order Cancellation** — `POST /api/v1/order/:orderId/cancel` validates that the requester owns the order, blocks cancellation once an order is `delivered`, `cancelled`, or `payment_failed`, and automatically issues a Stripe refund for orders that were paid online.
- **Order Details by Session ID** — `getOrderBySessionId` retrieves the correct order right after a Stripe redirect, using the `session_id` query param.
- **Stripe Webhook** — a dedicated webhook controller listens for `checkout.session.completed` (confirms the order and stores the `paymentIntentId`) and `payment_intent.payment_failed` (marks the order as `payment_failed`), with signature verification via `WEBHOOK_ENDPOINT_SECRET`.
- **Cross-origin auth fixed** — cookies are now correctly issued with `secure: true` and `sameSite: "none"` when `NODE_ENV=production`, which is required for the frontend (Vercel) and backend (Render) living on different domains. CORS now accepts a comma-separated list of allowed origins instead of a single hardcoded one.
- **Email verification removed** — the OTP/email-verification flow was removed as a feature; accounts are active immediately on signup. All related routes, store methods, and UI have been stripped out.

<br/>

## 🛠 Tech Stack

<div align="center">

### Backend
`Node.js` · `Express` · `TypeScript` · `MongoDB + Mongoose` · `Socket.IO` · `JWT` · `Cloudinary` · `Stripe (Checkout + Webhooks + Refunds)` · `OpenCage Geocoding`

### Frontend
`React` · `Vite` · `TypeScript` · `Tailwind CSS` · `shadcn/ui` · `Zustand` · `React Router` · `Leaflet` · `Socket.IO Client` · `Axios` · `Sonner`

</div>

<br/>

## 📁 Project Structure

<details>
<summary><b>Click to expand full folder structure</b> 📂</summary>




</details>

<br/>

## 🚀 Getting Started

### Prerequisites
> `Node.js 18+` · `MongoDB` (local or Atlas) · `Git` · A `Stripe` account (test mode is fine) · An `OpenCage` API key (free tier, 2500 req/day)

### 1️⃣ Clone the repository
```bash
git clone https://github.com/codecsuman/food-delivery-app.git
cd food-delivery-app
```

### 2️⃣ Backend setup
```bash
cd server
npm install
npm run dev
```

### 3️⃣ Frontend setup
```bash
cd client
npm install
npm run dev
```

### 4️⃣ Open in browser

| Service | URL |
|---|---|
| 🖥️ Frontend | http://localhost:5173 |
| ⚙️ Backend API | http://localhost:8001 |
| ❤️ Health Check | http://localhost:8001/health |

<br/>

## 🔧 Environment Variables

### Backend — `server/.env`

**Never commit this file — use the placeholder values below as a template and keep real secrets out of Git.**

```env
# =========================
# SERVER
# =========================
PORT=8001
NODE_ENV=development
# Comma-separated list — add every deployed frontend origin here
FRONTEND_URL=http://localhost:5173

# =========================
# DATABASE
# =========================
MONGO_URI=mongodb://localhost:27017/suman_food

# =========================
# JWT
# =========================
SECRET_KEY=your-super-secret-jwt-key-min-32-chars

# =========================
# STRIPE
# =========================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
WEBHOOK_ENDPOINT_SECRET=whsec_your_webhook_secret

# =========================
# CLOUDINARY
# =========================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# =========================
# OPENCAGE (FREE GEOCODING - 2500 req/day)
# =========================
OPENCAGE_API_KEY=your_opencage_api_key

# =========================
# DELIVERY SETTINGS
# =========================
DELIVERY_SPEED_KM_PER_MIN=0.333
MAX_DELIVERY_RADIUS_KM=10
MIN_ORDER_AMOUNT=50
```

> ⚠️ **`NODE_ENV` must be set as a real environment variable on your hosting platform's dashboard (Render, Railway, etc.) — not just in a local `.env` file.** Node only loads `.env` via `dotenv`; it never reads `.env.production` automatically. Cookie security (`secure` + `sameSite: "none"`) depends entirely on `NODE_ENV === "production"` being true at runtime — if it isn't set correctly, cross-origin login will silently fail with a `401` on the very next request after login.

### Frontend — `client/.env`

```env
VITE_API_BASE_URL=http://localhost:8001/api/v1
VITE_SOCKET_URL=http://localhost:8001
```

> 💡 In production, point these at your deployed backend's full URL (e.g. `https://your-backend.onrender.com`). Never use relative paths (`/api/v1/...`) — they only work locally thanks to Vite's dev proxy and will 404 once the frontend and backend are on separate domains (e.g. Vercel + Render).

<br/>

## ☁️ Deployment

**Frontend → Vercel**
- Build Command: `npm run build`
- Output Directory: `dist`
- Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to your live backend URL in Vercel's Environment Variables

**Backend → Render**
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Set every variable from the `.env` template above directly in Render's **Environment** tab — including `NODE_ENV=production` and `FRONTEND_URL` set to your exact Vercel URL (no trailing slash)
- Confirm the service is served over `https://` (Render does this by default) — cookies marked `secure: true` are dropped entirely over plain `http://`

<br/>

## 🎯 How to Use

<table>
<tr>
<td width="50%" valign="top">

**🏪 Restaurant Owners**
1. Sign up — every user is admin-enabled
2. Go to **Dashboard → Restaurant**, create your storefront
3. Drag the pin on the map (or tap "Use My Location") to set your exact delivery-origin point
4. **Dashboard → Menu** — add food items with images
5. **Dashboard → Orders** — manage incoming orders, including COD orders

</td>
<td width="50%" valign="top">

**🛍️ Customers**
1. Sign up for an account
2. Browse or search restaurants by name/city/cuisine — filters update live as new cuisines/dishes are added
3. Add items to cart & check out via **Stripe or Cash on Delivery**
4. Watch your order move live on the map, or cancel it from the **Active Orders** tab if you change your mind

</td>
</tr>
</table>

<br/>

## 📦 Order Lifecycle

Placed → Confirmed → Preparing → On the Way → Delivered
│
└── Cancelled (customer-initiated, before Delivered)
└── Payment Failed (Stripe orders only, via webhook)


- **Stripe orders** move to `Confirmed` once the `checkout.session.completed` webhook fires; a failed payment attempt is caught by `payment_intent.payment_failed` and marks the order `payment_failed`.
- **COD orders** skip the Stripe round-trip entirely and are created directly with `status: "confirmed"`.
- **Cancellation** is only allowed while an order is still `pending` or `confirmed`. Cancelling a paid Stripe order automatically triggers a refund; cancelling a COD order simply updates its status.
- **"On the Way"** status enables live map tracking — the customer sees the driver's position update in real time via Socket.IO, along with a live ETA and remaining distance.

<br/>

## 📡 API Reference

<details>
<summary><b>🔐 Authentication</b></summary>

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/user/signup` | Register new user (active immediately, no email verification) |
| POST | `/api/v1/user/login` | Login user |
| POST | `/api/v1/user/logout` | Logout user |
| GET | `/api/v1/user/check-auth` | Check authentication |
| PUT | `/api/v1/user/profile/update` | Update profile |
| POST | `/api/v1/user/forgot-password` | Request password reset |
| POST | `/api/v1/user/reset-password/:token` | Reset password |

</details>

<details>
<summary><b>🏪 Restaurant</b></summary>

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/restaurant/` | Create restaurant — requires `lat`/`lng` |
| GET | `/api/v1/restaurant/` | Get my restaurant |
| PUT | `/api/v1/restaurant/` | Update restaurant |
| GET | `/api/v1/restaurant/my-restaurants` | Get all my restaurants |
| GET | `/api/v1/restaurant/all` | Get all restaurants (public) |
| GET | `/api/v1/restaurant/search/:searchText` | Search restaurants (path text) |
| GET | `/api/v1/restaurant/search` | Search restaurants (query params + filters) |
| GET | `/api/v1/restaurant/filters` | Get distinct cuisines & dish names for filter UI |
| GET | `/api/v1/restaurant/:id` | Get single restaurant |
| DELETE | `/api/v1/restaurant/:id` | Delete restaurant |

</details>

<details>
<summary><b>📋 Menu</b></summary>

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/menu/` | Add menu item |
| PUT | `/api/v1/menu/:id` | Edit menu item |
| DELETE | `/api/v1/menu/:id` | Delete menu item |
| GET | `/api/v1/menu/restaurant/:id` | Get menu by restaurant |

</details>

<details>
<summary><b>📦 Order</b></summary>

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/order/checkout` | Create an order — `paymentMethod: "stripe"` starts a Checkout session (enforces `MIN_ORDER_AMOUNT`), `paymentMethod: "cod"` confirms the order immediately |
| POST | `/api/v1/order/webhook` | Stripe webhook — handles `checkout.session.completed` and `payment_intent.payment_failed` |
| GET | `/api/v1/order/` | Get my orders (restaurant location included for map tracking) |
| GET | `/api/v1/order/:orderId` | Get single order by ID |
| GET | `/api/v1/order/session/:sessionId` | Get order by Stripe session ID (used on redirect back from Stripe) |
| POST | `/api/v1/order/:orderId/cancel` | Cancel an order — ownership + status checks, automatic Stripe refund for paid orders |

</details>

<details>
<summary><b>🗺️ Map & Tracking</b></summary>

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/map/reverse-geocode` | Convert coordinates to a human-readable address |
| POST | `/api/v1/map/tracking/route` | Get a route polyline between two points (used for the live tracking line) |

All map routes require authentication.

</details>

<br/>

## 🗺 Roadmap

Planned features, not yet built:

- [ ] **Featured Restaurants & Menu Items** — restaurant owners get a toggle to mark items/restaurants as "Featured," surfaced in a home page carousel
- [ ] Separate navbar views for restaurant owners (Dashboard/My Restaurants/Orders) vs. regular customers (Home/Explore/Orders)
- [ ] "Order Now" button on menu items — skip the cart and go straight to checkout for a single item
- [ ] Customer reviews — star ratings & comments on restaurants
- [ ] Success animation on profile update confirmation
- [ ] Delivery partner assignment as a real driver role (currently location updates are simulated/manual)

<details>
<summary><b>✅ Recently shipped</b></summary>

- [x] Restaurant geolocation via drag-a-pin map (replaces missing/`[0,0]` coordinates)
- [x] Real-time order tracking with live map, driver position, ETA, and route (Socket.IO + Leaflet)
- [x] Stripe minimum-order-amount validation, preventing checkout failures on small carts
- [x] Order/Stripe-session sequencing fix — no more orphaned pending orders
- [x] Correct failed-payment webhook matching via PaymentIntent metadata
- [x] Cross-origin cookie & CORS fixes for separate frontend/backend deployments
- [x] Email verification (OTP) flow fully removed
- [x] Cash on Delivery (COD) as a payment option alongside Stripe
- [x] Order cancellation with automatic Stripe refunds
- [x] Order status tracking with an animated progress bar

</details>

<br/>

## 🐛 Troubleshooting

<details>
<summary><b>Login succeeds but the very next request returns 401 Unauthorized</b></summary>

This is a cross-origin cookie issue. If your frontend and backend are on **different domains** (e.g. Vercel + Render):

1. Confirm `NODE_ENV=production` is set as an actual environment variable in your hosting dashboard — not just in a `.env` file, which most hosts don't auto-load.
2. Confirm your backend is served over `https://` — `secure: true` cookies are silently dropped over plain `http://`.
3. Confirm `FRONTEND_URL` on the backend exactly matches your deployed frontend origin (including `https://`, no trailing slash).
</details>

<details>
<summary><b>"Restaurant location (lat/lng) is required" when creating/updating a restaurant</b></summary>

Open **Dashboard → Restaurant** and drag the map pin to your location (or tap "Use My Location"). This is required so delivery distance and live tracking can be calculated correctly — restaurants can no longer default to `[0, 0]` coordinates.
</details>

<details>
<summary><b>Checkout fails with a Stripe "amount must convert to at least 50 cents" error</b></summary>

This is now caught before it reaches Stripe — if you still see it, your cart total is below `MIN_ORDER_AMOUNT` (default ₹50). Check the value set in your backend `.env`.
</details>

<details>
<summary><b>Port already in use (EADDRINUSE)</b></summary>

```bash
taskkill /F /IM node.exe
```
Then restart with `npm run dev`.
</details>

<details>
<summary><b>Module not found (ERR_MODULE_NOT_FOUND)</b></summary>

All backend imports use `.js` extensions on relative paths (required for NodeNext ESM module resolution) — make sure you're on the latest files and haven't stripped the extensions during an edit.
</details>

<details>
<summary><b>MongoDB connection failed</b></summary>

1. Confirm MongoDB is installed and running
2. Check `MONGO_URI` in `.env`
3. Local: `mongodb://localhost:27017/suman_food`
4. Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/suman_food`
</details>

<details>
<summary><b>Cloudinary upload fails</b></summary>

Check your Cloudinary credentials in `.env` — otherwise the app falls back to placeholder images.
</details>

<details>
<summary><b>Stripe webhook not firing locally</b></summary>

Use the Stripe CLI to forward events to your local server:

```bash
stripe listen --forward-to localhost:8001/api/v1/order/webhook
```

Copy the `whsec_...` value it prints into `WEBHOOK_ENDPOINT_SECRET` in your `.env`.
</details>

<details>
<summary><b>Live tracking map shows the wrong location / falls back to a default</b></summary>

Confirm the order's restaurant document actually has `location.coordinates` set (create/update the restaurant via the map picker if it doesn't), and that your `getOrders`