# Suman Food - Restaurant Management App

A full-stack food delivery and restaurant management application built with the MERN stack (MongoDB, Express, React, Node.js).

## ✨ Features

- **User Authentication** - Sign up, login, forgot password, email verification
- **Restaurant Management** - Any user can create their own restaurant
- **Menu Management** - Add, edit, delete food items with images
- **Order System** - Customers can order food, restaurant owners can manage orders
- **Search & Filter** - Search restaurants by name, city, country, cuisine
- **Dark Mode** - Toggle between light and dark themes
- **Responsive Design** - Works on desktop and mobile

## 🛠 Tech Stack

### Backend
- **Node.js + Express** - Server framework
- **TypeScript** - Type safety
- **MongoDB + Mongoose** - Database
- **JWT** - Authentication tokens
- **Cloudinary** - Image uploads
- **Stripe** - Payment processing
- **Mailtrap** - Email testing
- **tsx** - Modern TypeScript execution (no deprecated flags)

### Frontend
- **React + Vite** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS + shadcn/ui** - Styling
- **Zustand** - State management
- **React Router** - Navigation
- **Axios** - API calls
- **Sonner** - Toast notifications

## 📁 Project Structure

```
food-app/
├── server/                   # Backend
│   ├── index.ts              # Main server file
│   ├── package.json          # Dependencies
│   ├── tsconfig.json         # TypeScript config
│   ├── nodemon.json          # Nodemon config
│   ├── .env                  # Environment variables
│   ├── start.bat             # Windows start script
│   ├── controller/           # Route handlers
│   │   ├── user.controller.ts
│   │   ├── restaurant.controller.ts
│   │   ├── menu.controller.ts
│   │   └── order.controller.ts
│   ├── routes/               # API routes
│   │   ├── user.route.ts
│   │   ├── restaurant.route.ts
│   │   ├── menu.route.ts
│   │   └── order.route.ts
│   ├── models/               # Database schemas
│   │   ├── user.model.ts
│   │   ├── restaurant.model.ts
│   │   ├── menu.model.ts
│   │   └── order.model.ts
│   ├── middlewares/          # Auth, upload, etc.
│   │   ├── isAuthenticated.ts
│   │   └── multer.ts
│   ├── utils/                # Helpers
│   │   ├── cloudinary.ts
│   │   ├── generateToken.ts
│   │   └── imageUpload.ts
│   ├── db/                   # Database connection
│   │   └── connectDB.ts
│   └── mailtrap/             # Email service
│       ├── email.ts
│       ├── htmlEmail.ts
│       └── mailtrap.ts
│
└── client/                   # Frontend
    ├── src/
    │   ├── App.tsx            # Main app component
    │   ├── main.tsx           # Entry point
    │   ├── components/        # UI components
    │   │   ├── Navbar.tsx
    │   │   ├── HereSection.tsx
    │   │   ├── Profile.tsx
    │   │   ├── Cart.tsx
    │   │   ├── SearchPage.tsx
    │   │   ├── RestaurantDetail.tsx
    │   │   ├── AvailableMenu.tsx
    │   │   ├── FilterPage.tsx
    │   │   ├── Footer.tsx
    │   │   ├── Loading.tsx
    │   │   ├── Success.tsx
    │   │   └── CheckoutConfirmPage.tsx
    │   ├── admin/              # Admin dashboard
    │   │   ├── Restaurant.tsx
    │   │   ├── AddMenu.tsx
    │   │   ├── EditMenu.tsx
    │   │   └── Orders.tsx
    │   ├── auth/               # Auth pages
    │   │   ├── Login.tsx
    │   │   ├── Signup.tsx
    │   │   ├── ForgotPassword.tsx
    │   │   ├── ResetPassword.tsx
    │   │   └── VerifyEmail.tsx
    │   ├── store/               # Zustand stores
    │   │   ├── useUserStore.ts
    │   │   ├── useRestaurantStore.ts
    │   │   ├── useMenuStore.ts
    │   │   ├── useCartStore.ts
    │   │   ├── useOrderStore.ts
    │   │   └── useThemeStore.ts
    │   ├── types/               # TypeScript types
    │   │   ├── restaurantType.ts
    │   │   ├── orderType.ts
    │   │   └── cartType.ts
    │   ├── schema/               # Zod validation schemas
    │   │   ├── userSchema.ts
    │   │   ├── restaurantSchema.ts
    │   │   └── menuSchema.ts
    │   ├── layout/               # Layout components
    │   │   └── MainLayout.tsx
    │   └── utils.ts              # Utility functions
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── tailwind.config.js
```

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+ installed
- MongoDB installed and running locally
- Git (optional)

### 1. Clone or Download the Project

```bash
git clone <your-repo-url>
cd food-app
```

### 2. Backend Setup

```bash
cd server

# Install dependencies
npm install

# Create .env file (copy from .env.example or create manually)
# See Environment Variables section below

# Start the server
npm run dev
```

Or simply double-click `start.bat` (Windows) to auto-start.

### 3. Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 4. Open in Browser

- Frontend: http://localhost:5173
- Backend API: http://localhost:8001
- Health Check: http://localhost:8001/health

## 🔧 Environment Variables

Create a `.env` file in the `server/` folder:

```env
# =========================
# SERVER
# =========================
PORT=8001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# =========================
# DATABASE
# =========================
MONGO_URI=mongodb://localhost:27017/suman_food

# =========================
# JWT
# =========================
SECRET_KEY=your-super-secret-jwt-key-change-this-in-production

# =========================
# STRIPE (Payment)
# =========================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
WEBHOOK_ENDPOINT_SECRET=whsec_your_webhook_secret

# =========================
# CLOUDINARY (Image Uploads)
# =========================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# =========================
# MAILTRAP (Email Testing)
# =========================
MAILTRAP_API_TOKEN=your_mailtrap_token
MAILTRAP_TEST_INBOX_ID=your_inbox_id
MAILTRAP_SENDER_EMAIL=your_sender@email.com
```

> **Note:** The app works without Cloudinary and Mailtrap configured - images will use placeholders and emails will be logged to console.

## 🎯 How to Use

### For Restaurant Owners

1. **Sign Up** - Create an account (everyone is automatically an admin)
2. **Dashboard → Restaurant** - Create your restaurant with name, city, cuisines, and image
3. **Dashboard → Menu** - Add food items with name, description, price, and image
4. **Dashboard → Orders** - View and manage incoming orders

### For Customers

1. **Sign Up** - Create an account
2. **Home** - Browse restaurants or search by name/city/cuisine
3. **Restaurant Page** - View menu and add items to cart
4. **Cart** - Review order and checkout with Stripe
5. **Orders** - Track order status

## 🐛 Troubleshooting

### Port Already in Use (EADDRINUSE)

**Problem:** `Error: listen EADDRINUSE: address already in use :::8001`

**Solution:**

```bash
# Kill all Node processes
taskkill /F /IM node.exe

# Or use the provided script
npm run kill
npm run restart
```

Or simply double-click `start.bat` which auto-kills the old process.

### Module Not Found (ERR_MODULE_NOT_FOUND)

**Problem:** `Cannot find module './db/connectDB'`

**Solution:** All imports now use `.ts` extensions for ESM compatibility. Make sure you're using the latest files.

### MongoDB Connection Failed

**Problem:** `MongoDB connection error`

**Solution:**

1. Make sure MongoDB is installed and running
2. Check `MONGO_URI` in `.env`
3. For local MongoDB: `mongodb://localhost:27017/suman_food`
4. For MongoDB Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/suman_food`

### Cloudinary Image Upload Fails

**Problem:** Images not uploading

**Solution:**

1. Check Cloudinary credentials in `.env`
2. Or the app will use placeholder images automatically

### Email Not Sending

**Problem:** Welcome/verification emails not received

**Solution:**

1. Check Mailtrap credentials in `.env`
2. Or emails will be logged to console for testing

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/user/signup` | Register new user |
| POST | `/api/v1/user/login` | Login user |
| POST | `/api/v1/user/logout` | Logout user |
| GET | `/api/v1/user/check-auth` | Check authentication |
| PUT | `/api/v1/user/profile/update` | Update profile |
| POST | `/api/v1/user/forgot-password` | Request password reset |
| POST | `/api/v1/user/reset-password/:token` | Reset password |

### Restaurant

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/restaurant/` | Create restaurant |
| GET | `/api/v1/restaurant/` | Get my restaurant |
| PUT | `/api/v1/restaurant/` | Update restaurant |
| GET | `/api/v1/restaurant/search/:text` | Search restaurants |
| GET | `/api/v1/restaurant/:id` | Get single restaurant |

### Menu

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/menu/` | Add menu item |
| PUT | `/api/v1/menu/:id` | Edit menu item |
| DELETE | `/api/v1/menu/:id` | Delete menu item |
| GET | `/api/v1/menu/restaurant/:id` | Get menu by restaurant |

### Order

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/v1/order/checkout` | Create checkout session |
| POST | `/api/v1/order/webhook` | Stripe webhook |
| GET | `/api/v1/order/` | Get my orders |
| GET | `/api/v1/order/:sessionId` | Get order by session |

## 🔒 Security Notes

- **JWT tokens** are stored in HTTP-only cookies
- **Passwords** are hashed with bcrypt
- **Image uploads** are validated (type, size)
- **CORS** is configured for frontend origin only
- **Users** can only manage their own restaurant and orders

## 📄 License

ISC License

## 🙏 Credits

Built with ❤️ using:

- [React](https://react.dev/)
- [Express](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)