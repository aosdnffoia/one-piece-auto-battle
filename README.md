# One Piece Auto Battler

Backend skeleton for the One Piece TFT-style auto battler. Includes JWT auth, lobby endpoints, matchmaking queue, bot fallback, and Socket.io events.

## Setup
- Copy `.env.example` to `.env` and set `JWT_SECRET`.
- Install deps: `npm install`
- Run dev server: `npm run dev` (defaults to port 3000)
- Frontend: `cd client && npm install`

## Scripts
- `npm run dev` — start server with reload
- `npm run build` — type-check and emit JS to `dist`
- `npm start` — run compiled server
- `npm run check` — type-check without emit
- `npm test` — run unit tests (JWT helpers + auth middleware; socket test skipped in sandbox)
- Frontend (React):
- `cd client && npm run dev` (Vite dev server on 5173; set `VITE_API_BASE=http://localhost:3000` if backend differs)
- `cd client && npm run build` to generate `client/dist`

## Docker
- Build: `docker build -t one-piece-auto-battle .`
- Run: `docker run -p 3000:3000 --env-file .env one-piece-auto-battle`

## Quick API/Socket Flow
1) Login to get a token:
```bash
curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"username":"luffy"}'
```
2) Use the token to connect via Socket.io with `auth: { token: "<jwt>" }`.
3) Emit `join_queue` with optional `{ allowBot: true }` to get matched quickly (bot after ~1s if alone).
4) Listen for `match_found` and `round_start` (placeholder bot battle message).

## Game Data (Phase 2)
- Static seeds for 49 units, faction synergies, and role synergies live in `src/gameData`.
- HTTP endpoints:
- `GET /api/units` — serialized unit list (for shop/formation UI)
- `GET /api/synergies` — faction + role synergy definitions
- `POST /api/synergy-preview` body `{ "unitIds": ["luffy","zoro"] }` — returns active synergies for selected units
- `GET /api/shop` — current shop for the authed player
- `POST /api/shop/reroll` — spend coins (2) to refresh shop
- `POST /api/shop/buy` body `{ "unitId": "<id>" }` — buy from shop, deduct coins based on tier
- `POST /api/shop/sell` body `{ "instanceId": "<benchId>" }` — sell a benched unit, partial refund
- `GET /api/formation` — current formation (1x7 row)
- `POST /api/formation` body `{ "slots":[{"index":0,"instanceId":"..."}] }` — validate and set formation
- `POST /api/formation/lock` — lock current formation for battle
- Frontend: open `http://localhost:3000/` after starting the server to use the prototype UI (login, shop, bench, formation, queue).
- React client: run via Vite dev server (`cd client && npm run dev`) for the upgraded UI; default API base is `http://localhost:3000` or override with `VITE_API_BASE`.

## WebSocket Events (Phase 1)
Client -> Server:
- `join_queue` (payload: `{ allowBot?: boolean }`, ack returns `{ status, position }`)
- `leave_queue`
- `set_formation` payload `{ slots: [{ index, instanceId }] }` ack `{ status, formation? }`
- `lock_formation` ack `{ status, formation? }`

Server -> Client:
- `match_found` `{ roomId, opponent: { id, username }, isBot }`
- `round_start` placeholder message when paired with bot
- `shop_update` `{ shop, coins, level, shopVersion, bench }`
- `formation_update` `{ formation }`
- `synergy_update` `{ formation }`

## Notes
- State is in-memory for now (users reset on restart).
- Express endpoints: `/health`, `/api/login`, `/api/me`, `/api/lobby`.
- CI: basic type-check workflow in `.github/workflows/ci.yml`.
- Socket test is skipped in CI because binding to ports is blocked in this environment. Run locally to exercise Socket.io matchmaking.
- React client is pinned to Vite 5/React 18 for Node 18 compatibility; upgrade Node to use newer Vite/React templates if desired.
