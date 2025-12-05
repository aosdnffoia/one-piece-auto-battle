# One Piece Auto Battler

Backend skeleton for the One Piece TFT-style auto battler. Includes JWT auth, lobby endpoints, matchmaking queue, bot fallback, and Socket.io events.

## Setup
- Copy `.env.example` to `.env` and set `JWT_SECRET`.
- Install deps: `npm install`
- Run dev server: `npm run dev` (defaults to port 3000)

## Scripts
- `npm run dev` — start server with reload
- `npm run build` — type-check and emit JS to `dist`
- `npm start` — run compiled server
- `npm run check` — type-check without emit
- `npm test` — run unit tests (JWT helpers + auth middleware; socket test skipped in sandbox)

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

## WebSocket Events (Phase 1)
Client -> Server:
- `join_queue` (payload: `{ allowBot?: boolean }`, ack returns `{ status, position }`)
- `leave_queue`

Server -> Client:
- `match_found` `{ roomId, opponent: { id, username }, isBot }`
- `round_start` placeholder message when paired with bot

## Notes
- State is in-memory for now (users reset on restart).
- Express endpoints: `/health`, `/api/login`, `/api/me`, `/api/lobby`.
- CI: basic type-check workflow in `.github/workflows/ci.yml`.
- Socket test is skipped in CI because binding to ports is blocked in this environment. Run locally to exercise Socket.io matchmaking.
