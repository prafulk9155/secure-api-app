# Secure API App (Store & Blog)

Full-stack application with a React frontend and Express backend connected to MongoDB (`hmac_db`).

## Structure

```
secure-api-app/
├── backend/
│   ├── api/
│   │   └── db.js         # MongoDB connection (hmac_db)
│   ├── models.js         # Product, Order, Blog, ApiClient, RequestLog schemas
│   ├── security/         # Web session, request signing, secret-code guard
│   ├── scripts/seedClients.js  # Create a partner secret code
│   ├── server.js         # Express server with Products, Orders, and Blogs API
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx       # Catalog, Blog Reader, Login & Orders UI
    │   ├── AttackLab.jsx # Try copied-request attacks in the browser
    │   ├── api/secureFetch.js  # Signs every public API call
    │   └── main.jsx
    ├── vite.config.js    # Vite proxy to backend
    └── package.json
scripts/attack-demo.js    # Same attacks from Node (Postman/curl style)
```

## Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev    # Or npm start (runs on http://localhost:5000)
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev    # Runs on http://localhost:5173
```

### 3. Secure the public APIs
Copy `backend/.env.example` to `backend/.env` and set `WEB_TOKEN_SECRET` and `HMAC_SECRET` (the file shows how to generate them). Optional: create a partner code.
```bash
cd backend
npm run seed:client -- demo-partner 5   # prints the secret code once
```

## How the public APIs are protected

`/api/blogs`, `/api/blogs/:id` and `POST /api/subscribe` have no login, but they only answer two kinds of callers.

**1. Our website (signed web session)**
1. The page calls `POST /api/web/session`. The server checks `Origin` against `CLIENT_ORIGIN`, rate-limits by IP, and returns a 10-minute JWT bound to the caller's IP and User-Agent plus a `sessionKey` derived from the token id.
2. `frontend/src/api/secureFetch.js` imports the key as a non-extractable WebCrypto key and signs every call:
   `x-sig = base64(HMAC-SHA256(sessionKey, METHOD \n path?query \n ts \n nonce \n sha256(body)))`
   and sends `x-web-token`, `x-ts`, `x-nonce`, `x-sig`.
3. `backend/security/webGuard.js` checks the token, IP, User-Agent, a timestamp within 60s, the signature, and that the nonce was never used (kept 120s), then applies a per-session rate limit.

**2. Partners (secret code)**
Send `x-secret-code: sc_...`. Codes are stored as SHA-256 hashes in `ApiClient`, and each client has its own per-minute limit.

Every request, allowed or rejected, is written to `RequestLog` with its channel, reason, client and IP. `GET /api/admin/logs` (localhost, or `x-admin-key` when `ADMIN_KEY` is set) summarises the last hour.

### What a copied cURL gets
| Attempt | Answer |
|---|---|
| Plain Postman / curl call | 401 `missing_token` |
| Copied request replayed as-is | 401 `nonce_reused` |
| Copied headers with a new nonce, URL or body | 401 `bad_signature` |
| Copied request sent a minute later | 401 `stale_timestamp` |
| Token used from another IP / browser | 401 `ip_mismatch` / `ua_mismatch` |
| Session asked for from another site | 403 `bad_origin` |
| Too many calls | 429 `rate_limited` |

### Try it
- **In the browser:** open the **Attack Lab** tab and click *Run all in order*. Paste a partner code to see the per-client limit return 429s, then load the usage log.
- **From Node:** with the backend running,
  ```bash
  node scripts/attack-demo.js
  ```
  `API_BASE` changes the server address and `SECRET_CODE` adds a valid partner call.

### Rolling out
Start with `GUARD_MODE=log`: nothing is blocked, but rejected requests are logged with `wouldBlock: true`. Once the website's traffic shows no false rejections, switch to `GUARD_MODE=enforce`. Behind a load balancer, set `TRUST_PROXY` so the real client IP is used.

### Limits
This stops copied requests, scripts and other sites from reusing your API for free. It cannot stop someone who runs your website's own JavaScript, for example a headless browser that loads the page and lets it sign requests. Short sessions, IP/UA binding, per-session and per-IP rate limits, and the rejection alerts in the log keep that kind of scraping slow and visible. The signing key is in the browser, so treat this as access control for anonymous traffic, not as authentication.
