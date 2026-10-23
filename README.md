# Secure API App (Store & Blog)

Full-stack application with a React frontend and Express backend connected to MongoDB (`hmac_db`).

## Structure

```
secure-api-app/
├── backend/
│   ├── api/
│   │   └── db.js         # MongoDB connection (hmac_db)
│   ├── models.js         # Product, Order, and Blog schemas
│   ├── server.js         # Express server with Products, Orders, and Blogs API
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx       # Catalog, Blog Reader, Login & Orders UI
    │   └── main.jsx
    ├── vite.config.js    # Vite proxy to backend
    └── package.json
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
