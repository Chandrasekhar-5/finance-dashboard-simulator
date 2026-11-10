# Banking Dashboard frontend

React + TypeScript + Vite frontend for the Express API in `../backend`.

## Run locally

1. Start the backend at `http://localhost:5000` and set its `FRONTEND_URL=http://localhost:5173`.
2. Copy `.env.example` to `.env` if the API is hosted elsewhere.
3. Run `npm install` and `npm run dev` from this folder.

The UI keeps access tokens only in memory. It sends the backend's HTTP-only refresh cookie with `credentials: include`, restores a session through `/auth/refresh`, and retries one failed protected request after refreshing.

The initial dashboard calls only existing endpoints: `GET /auth/me`, `GET /accounts`, and `GET /transactions/history`.
