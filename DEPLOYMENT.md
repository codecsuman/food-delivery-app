# Deployment Guide

## Overview

This guide covers production deployment of the Food Delivery App with all security hardening applied.

## Prerequisites

- Node.js 20+
- MongoDB 6+ (Atlas recommended for production)
- Stripe account (for payments)
- Cloudinary account (for images)
- OpenCage API key (for geocoding)
- Domain with SSL certificate

---

## Server Deployment

### 1. Environment Setup

```bash
# Clone repository
git clone <your-repo>
cd food-app-yt-main/server

# Copy environment template
cp .env.example .env

# Edit .env with production values
# CRITICAL: Generate strong SECRET_KEY (32+ chars)
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | Server port (e.g., 8001) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `SECRET_KEY` | Yes | JWT secret (32+ random chars) |
| `FRONTEND_URL` | Yes | Production frontend URL(s) |
| `OPENCAGE_API_KEY` | Yes | Geocoding API key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `WEBHOOK_ENDPOINT_SECRET` | Yes | Stripe webhook signing secret |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `DELIVERY_SPEED_KM_PER_MIN` | No | Default: 0.333 |
| `MAX_DELIVERY_RADIUS_KM` | No | Default: 10 |
| `MIN_ORDER_AMOUNT` | No | Default: 50 |

### 3. Build and Start

```bash
npm install
npm run build
npm start
```

### 4. Process Manager (PM2)

```bash
npm install -g pm2
pm2 start dist/index.js --name food-api
pm2 startup
pm2 save
```

---

## Client Deployment

### 1. Environment Setup

```bash
cd ../client
cp .env.example .env
```

### 2. Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes | Backend API URL (e.g., https://api.yourdomain.com/api/v1) |
| `VITE_SOCKET_URL` | Yes | Backend Socket.IO URL (e.g., https://api.yourdomain.com) |

### 3. Build

```bash
npm install
npm run build
```

### 4. Deploy Static Files

Deploy `dist/` folder to:
- Vercel/Netlify (recommended)
- Nginx/Apache
- AWS S3 + CloudFront

---

## Database Setup

### MongoDB Atlas (Recommended)

1. Create cluster at https://cloud.mongodb.com
2. Create database user with read/write permissions
3. Whitelist server IP addresses
4. Get connection string
5. Enable `2dsphere` index for geospatial queries (auto-created on first run)

> **Transactions:** Atlas is a replica set, so COD checkout and Stripe webhook confirmation use atomic transactions. Never point production at a standalone `mongod`; the API has a compensating-write fallback, but it cannot guarantee the same atomicity. Verify `GET /health` → `transactions.supported: true` after deployment.

### Indexes (Auto-created)

- User: email (unique), verificationToken
- Restaurant: 2dsphere (location), text (name, city, country), cuisines, city+country
- Menu: name+restaurant, text (name, description), price, restaurant, popular, orderCount
- Order: user, restaurant, status, createdAt, user+status, paymentMethod
- Review: restaurant+createdAt, user+createdAt

---

## Stripe Configuration

### 1. Webhook Endpoint

Add webhook in Stripe Dashboard:
- URL: `https://api.yourdomain.com/api/v1/order/webhook`
- Events to listen:
  - `checkout.session.completed`
  - `payment_intent.payment_failed`
  - `checkout.session.expired`

### 2. Get Signing Secret

Copy `whsec_...` from webhook details → `WEBHOOK_ENDPOINT_SECRET`

### 3. Test Mode vs Live Mode

- Development: Use test keys (`sk_test_...`, `whsec_test_...`)
- Production: Switch to live keys

---

## Cloudinary Configuration

1. Create account at https://cloudinary.com
2. Get credentials from Dashboard
3. Set up upload presets if needed (optional)
4. Configure folder structure: `suman-food/restaurants`, `suman-food/menus`, `suman-food/avatars`

---

## OpenCage Geocoding

1. Sign up at https://opencagedata.com
2. Get API key
3. Set rate limits in dashboard (free tier: 2,500/day)
4. Monitor usage to avoid quota exhaustion

---

## Nginx Reverse Proxy (Production)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    location / {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Webhook needs raw body
    location /api/v1/order/webhook {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Security Checklist

- [ ] `.env` files NOT in git (verify with `git status`)
- [ ] `SECRET_KEY` is 32+ random characters
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` set to exact production domain(s)
- [ ] HTTPS enforced (SSL cert valid)
- [ ] Stripe webhook URL configured and tested
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Rate limiting active on all sensitive endpoints
- [ ] Helmet security headers present
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=None`
- [ ] No `VITE_*` secrets in client build
- [ ] OpenCage API key only on server
- [ ] Structured logging configured
- [ ] Health check endpoint responding
- [ ] Graceful shutdown tested

---

## Monitoring & Alerts

### Health Checks

```bash
# Basic health
curl https://api.yourdomain.com/health

# Expected response:
{
  "status": "OK",
  "database": "connected",
  "uptime": 12345,
  "memory": {...}
}
```

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|-----------------|
| API response time | > 2s p95 |
| Error rate | > 1% |
| Database connections | > 80% pool |
| Stripe webhook failures | > 0 |
| Auth failure rate | > 10/min |
| Socket.IO connections | unexpected drops |

### Log Aggregation

Configure log shipping to:
- Datadog / New Relic / Elastic
- Or self-hosted: Loki + Grafana

---

## Backup & Recovery

### Database Backups

```bash
# Daily automated backup (Atlas does this automatically)
# Manual backup:
mongodump --uri="mongodb://..." --out=/backups/$(date +%F)

# Restore:
mongorestore --uri="mongodb://..." /backups/2024-01-15
```

### Secret Rotation

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| JWT SECRET_KEY | 90 days | Generate new, update .env, restart, invalidate sessions |
| Stripe keys | 90 days | Rotate in Stripe dashboard, update .env, restart |
| Cloudinary keys | 90 days | Rotate in Cloudinary dashboard, update .env, restart |
| OpenCage key | As needed | Rotate in OpenCage dashboard, update .env |

---

## Staging Verification Process

Before each production deploy:

1. **Deploy to staging** (identical infra, separate domain)
2. **Run smoke tests**:
   - Signup → Login → Profile update
   - Browse restaurants → Search → Filter
   - Add to cart → Checkout (COD + Stripe test card)
   - Address picker → GPS → Pincode autocomplete
   - Place order → Track order (Socket.IO)
   - Cancel order (before delivery)
   - Admin: Create restaurant → Add menu → Update order status
3. **Security scan**: Run OWASP ZAP or similar
4. **Load test**: k6 or artillery (100 concurrent users)
5. **Verify logs**: No errors, no secrets in logs
6. **Sign off**: Checklist complete → Deploy to prod

---

## Rollback Procedure

```bash
# Quick rollback (PM2)
pm2 restart food-api --update-env

# Full rollback
git checkout <previous-tag>
cd server && npm run build && pm2 restart food-api
cd ../client && npm run build && deploy dist/

# Database rollback (if migration)
mongorestore --uri="..." /backups/last-known-good
```

---

## Support Contacts

| Service | Contact |
|---------|---------|
| MongoDB Atlas | https://cloud.mongodb.com/support |
| Stripe | https://support.stripe.com |
| Cloudinary | https://cloudinary.com/support |
| OpenCage | https://opencagedata.com/support |

---

## Appendix: File Structure

```
food-app-yt-main/
├── server/
│   ├── dist/              # Compiled output (gitignored)
│   ├── tests/             # Security tests
│   ├── src/
│   │   ├── controller/    # Route handlers
│   │   ├── middleware/    # Auth, validation, rate limit
│   │   ├── models/        # Mongoose schemas
│   │   ├── routes/        # API routes
│   │   ├── schemas/       # Zod validation schemas
│   │   ├── services/      # Business logic (mapService)
│   │   ├── socketHandlers/# Socket.IO handlers
│   │   ├── utils/         # Helpers (logger, cloudinary, tokens)
│   │   ├── db/            # DB connection
│   │   └── index.ts       # Entry point
│   ├── .env.example
│   └── package.json
├── client/
│   ├── dist/              # Build output (gitignored)
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── store/         # Zustand stores
│   │   ├── hooks/         # Custom hooks
│   │   ├── layout/        # Layout components
│   │   ├── auth/          # Auth pages
│   │   ├── admin/         # Admin pages
│   │   └── lib/           # Utilities
│   ├── .env.example
│   └── package.json
├── .gitignore
└── DEPLOYMENT.md
```

---

*Last updated: Security audit completed. All critical vulnerabilities addressed.*