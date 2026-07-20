<div align="center">

# 🍔 Suman Food

### A full-stack food delivery & restaurant management platform built on the MERN stack

<em>Order food, run a restaurant, manage everything — all in one app.</em>

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
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [How to Use](#-how-to-use)
- [API Reference](#-api-reference)
- [Roadmap](#-roadmap)
- [Troubleshooting](#-troubleshooting)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

<br/>

## 📝 About

**Suman Food** is a production-ready, full-stack food ordering and restaurant management system. Any user can spin up their own restaurant storefront, manage a menu, and start taking orders — while customers browse, search, and check out with real Stripe payments.

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
- 🔐 Secure signup, login & email verification
- 🔎 Real-time restaurant search with debounced input
- 🎛️ Live filters — cuisine, dish/food name, price range & location, pulled straight from the database
- 🌟 Featured Dishes & Restaurants carousel on the home page *(Coming Soon)*
- 🛒 Add to cart & Stripe checkout
- 📦 Track order status in real time
- 🌗 Light / Dark mode toggle
- 📱 Fully responsive design

</td>
<td width="50%">

### 🧑‍🍳 For Restaurant Owners
- 🏪 Create & manage your own restaurant
- 📋 Add / edit / delete menu items with images
- 🌟 Mark menu items or your restaurant as "Featured" *(Coming Soon)*
- 🖼️ Cloudinary-powered image uploads
- 📬 Manage incoming orders live
- 💳 Secure Stripe payment processing
- 📊 Full admin dashboard

</td>
</tr>
</table>

<br/>

## 🛠 Tech Stack

<div align="center">

### Backend
`Node.js` · `Express` · `TypeScript` · `MongoDB + Mongoose` · `JWT` · `Cloudinary` · `Stripe` · `Mailtrap` · `tsx`

### Frontend
`React` · `Vite` · `TypeScript` · `Tailwind CSS` · `shadcn/ui` · `Zustand` · `React Router` · `Axios` · `Sonner`

</div>

<br/>

## 📁 Project Structure

<details>
<summary><b>Click to expand full folder structure</b> 📂</summary>


food-app/
├── server/                   # Backend
│   ├── index.ts              # Main server file
│   ├── controller/           # Route handlers
│   ├── routes/                # API routes
│   ├── models/                # Database schemas
│   ├── middlewares/           # Auth, upload, etc.
│   ├── utils/                 # Helpers (Cloudinary, JWT)
│   ├── db/                    # Database connection
│   └── mailtrap/              # Email service
│
└── client/                   # Frontend
├── src/
│   ├── components/        # UI components
│   ├── admin/              # Admin dashboard
│   ├── auth/                # Auth pages
│   ├── store/               # Zustand stores
│   ├── types/                # TypeScript types
│   ├── schema/               # Zod validation schemas
│   └── layout/                # Layout components
├── vite.config.ts
└── tailwind.config.js

</details>

<br/>

## 🚀 Getting Started

### Prerequisites
> `Node.js 18+` · `MongoDB` (local or Atlas) · `Git`

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

Create a `.env` file inside `server/`:

```env
# SERVER
PORT=8001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# DATABASE
MONGO_URI=mongodb://localhost:27017/suman_food

# JWT
SECRET_KEY=your-super-secret-jwt-key

# STRIPE
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
WEBHOOK_ENDPOINT_SECRET=whsec_your_webhook_secret

# CLOUDINARY
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# MAILTRAP
MAILTRAP_API_TOKEN=your_mailtrap_token
MAILTRAP_TEST_INBOX_ID=your_inbox_id

```

> 💡 **Tip:** The app runs even without Cloudinary/Mailtrap configured — it falls back to placeholder images and console-logged emails.

<br/>

## 🎯 How to Use

<table>
<tr>
<td width="50%" valign="top">

**🏪 Restaurant Owners**
1. Sign up — every user is admin-enabled
2. Go to **Dashboard → Restaurant**, create your storefront
3. **Dashboard → Menu** — add food items with images
4. **Dashboard → Orders** — manage incoming orders

</td>
<td width="50%" valign="top">

**🛍️ Customers**
1. Sign up for an account
2. Browse or search restaurants by name/city/cuisine — filters update live as new cuisines/dishes are added
3. Add items to cart & check out via Stripe
4. Track your order status live

</td>
</tr>
</table>

<br/>

## 📡 API Reference

<details>
<summary><b>🔐 Authentication</b></summary>

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/user/signup` | Register new user |
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
| POST | `/api/v1/restaurant/` | Create restaurant |
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
| POST | `/api/v1/order/checkout` | Create checkout session |
| POST | `/api/v1/order/webhook` | Stripe webhook |
| GET | `/api/v1/order/` | Get my orders |
| GET | `/api/v1/order/:sessionId` | Get order by session |

</details>

<br/>

## 🗺 Roadmap

Planned features, not yet built:

- [ ] **Featured Restaurants & Menu Items** — restaurant owners get a toggle to mark items/restaurants as "Featured," surfaced in a home page carousel
- [ ] Separate navbar views for restaurant owners (Dashboard/My Restaurants/Orders) vs. regular customers (Home/Explore/Orders)
- [ ] "Order Now" button on menu items — skip the cart and go straight to checkout for a single item
- [ ] Cash on Delivery (COD) as a payment option alongside Stripe
- [ ] Customer reviews — star ratings & comments on restaurants
- [ ] Success animation on profile update confirmation

<br/>

## 🐛 Troubleshooting

<details>
<summary><b>Port already in use (EADDRINUSE)</b></summary>

```bash
taskkill /F /IM node.exe
npm run kill
npm run restart
```
Or double-click `start.bat` — it auto-kills the old process.
</details>

<details>
<summary><b>Module not found (ERR_MODULE_NOT_FOUND)</b></summary>

All imports use `.ts` extensions for ESM compatibility — make sure you're on the latest files.
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
<summary><b>Emails not sending</b></summary>

Check Mailtrap credentials in `.env` — otherwise emails are logged to console for testing.
</details>

<br/>

## 🔒 Security

- ✅ JWT tokens stored in **HTTP-only cookies**
- ✅ Passwords hashed with **bcrypt**
- ✅ Image uploads validated for type & size
- ✅ CORS locked to frontend origin only
- ✅ Users can only manage their own restaurant & orders

<br/>

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

```bash
1. Fork the project
2. Create your feature branch  → git checkout -b feature/AmazingFeature
3. Commit your changes        → git commit -m "Add some AmazingFeature"
4. Push to the branch         → git push origin feature/AmazingFeature
5. Open a Pull Request
```

<br/>

## 📄 License

Distributed under the **ISC License**.

<br/>

<div align="center">

### Built with ❤️ using

[React](https://react.dev/) · [Express](https://expressjs.com/) · [MongoDB](https://www.mongodb.com/) · [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/)

<br/>

⭐ **If you found this project useful, consider giving it a star!** ⭐

[![GitHub Stars](https://img.shields.io/github/stars/codecsuman/food-delivery-app?style=for-the-badge&logo=github&color=yellow)](https://github.com/codecsuman/food-delivery-app/stargazers)

<<<<<<< HEAD
</div>
EOF
git add README.md
git commit -m "docs: update README with real-time filters, full API reference, and roadmap"
git push
=======
</div>
>>>>>>> 1412f2a (Updated login page and fixed bugs)
