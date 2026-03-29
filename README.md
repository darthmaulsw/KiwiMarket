# KiwiMarket

**A prediction market for physical goods — powered by Solana and verified by AI.**

KiwiMarket lets anyone post a real-world challenge ("I bet nobody brings me a kiwi in 30 minutes"), stake SOL, and have a crowd bet YES or NO on whether it gets completed. When a fulfiller submits photo proof, Claude AI verifies the outcome and the smart escrow pays out winners automatically.

---

## What Is This?

Most prediction markets live entirely on-chain and resolve via oracles. KiwiMarket is different: the "oracle" is physical reality, captured as a photo and judged by an AI vision model. This makes it suitable for hyper-local, spontaneous, and real-world bets that no data feed could ever resolve — finding a charger, solving a coding problem in front of you, delivering a specific item.

**Core loop:**

1. **Post a bounty** — describe a physical challenge, set a SOL reward and expiry time
2. **Crowd bets YES or NO** — liquidity pools form around both outcomes
3. **Someone tries to fulfill** — submits a photo as proof
4. **Claude verifies** — AI judges whether the proof matches the bounty
5. **Automatic payout** — winners receive their share from the losing pool; the fulfiller gets the reward

---

## Liquidity Pools and Pricing

Each bounty has two liquidity pools: **YES** and **NO**. When the bounty is created both pools are seeded at 1.0 SOL to bootstrap initial odds. Every bet adds to one of the pools.

```
yes_price = yes_pool / (yes_pool + no_pool)
no_price  = no_pool  / (yes_pool + no_pool)
```

These prices update in real-time as bets come in and are displayed as probability percentages. If yes_pool = 3.0 and no_pool = 1.0, YES is priced at 75% and NO at 25%.

**Payout formula when bounty is fulfilled (YES wins):**

- Fulfiller receives: `reward_sol × 0.95`
- Each YES bettor receives: `bet_amount + (bet_amount / yes_pool) × no_pool × 0.95`
- NO bettors lose their stake

**Payout formula when bounty expires (NO wins):**

- Poster is refunded: `reward_sol`
- Each NO bettor receives: `bet_amount + (bet_amount / no_pool) × yes_pool × 0.95`
- YES bettors lose their stake

A **5% platform fee** is taken from the losing pool before distribution. All funds are held in an on-chain escrow wallet on Solana devnet and released by the backend on resolution.

---

## Architecture

```
┌─────────────────────────────────┐     ┌──────────────────────────────┐
│         React Frontend          │     │       FastAPI Backend         │
│  (Vite + TypeScript + Solana)   │────▶│  (Python + SQLite + Solana)  │
│                                 │     │                               │
│  Feed → browse live bounties    │     │  /bounties  – CRUD + pricing  │
│  BountyDetail → bet YES/NO      │     │  /bets      – pool accounting │
│  Create → post a bounty         │     │  /proof     – AI verification │
│  Profile → stats + history      │     │  /profile   – user stats      │
│  Wallet → P&L + activity feed   │     │                               │
└─────────────────────────────────┘     └──────────────────────────────┘
                │                                      │
                ▼                                      ▼
     Phantom Wallet (sign tx)            Solana Devnet (escrow wallet)
     @solana/web3.js                     Claude Vision API (AI judge)
```

**Bet flow (on-chain):**
1. User signs a `SystemProgram.transfer` to the escrow wallet via Phantom
2. Frontend confirms the transaction, sends tx signature to the backend
3. Backend records the bet and updates the pool

**Proof verification flow:**
1. Fulfiller uploads a photo; frontend sends it as base64 to `/proof/upload`
2. Backend stores the proof and spawns an async task
3. Task calls Claude's vision API with the image + bounty description
4. Claude returns `{ "verdict": "YES" | "NO", "reasoning": "..." }`
5. On YES: backend calls `resolve_bounty()` → pays fulfiller + YES bettors via escrow
6. Frontend polls `/proof/status/{bounty_id}` and shows the live verdict + reasoning

**Expiry mechanism:**
- A background task runs every 60 seconds
- Any bounty past its `expiry_at` with status `open` is marked `expired`
- `resolve_expired_bounty()` immediately pays out NO bettors and refunds the poster

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Routing | React Router DOM v6 |
| Wallet | @solana/wallet-adapter (Phantom, Solflare) |
| On-chain | @solana/web3.js, Solana Devnet |
| Backend | FastAPI, Uvicorn, Python 3.11+ |
| Database | SQLite via SQLAlchemy (swappable via `DATABASE_URL`) |
| AI Judge | Anthropic Claude (vision model) |
| Solana (backend) | solders, base58 |

---

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Phantom browser extension connected to **Devnet**
- Anthropic API key
- Solana escrow wallet keypair (base58 private key)

### Backend

```bash
cd backend
pip install -r requirements.txt

# Required env vars
export ANTHROPIC_API_KEY=sk-ant-...
export ESCROW_PRIVATE_KEY=<base58-encoded-private-key>

uvicorn main:app --host 127.0.0.1 --port 8002 --reload
```

### Frontend

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

The Vite dev server proxies `/bounties`, `/bets`, `/proof`, and `/profile` to `http://localhost:8002`.

### ngrok (remote access / mobile testing)

```bash
ngrok http 5173
```

Update `server.allowedHosts` in `vite.config.ts` with your ngrok domain.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/bounties/active` | List open, non-expired bounties |
| `GET` | `/bounties/{id}` | Single bounty with live yes_price / no_price |
| `POST` | `/bounties` | Create a bounty |
| `GET` | `/bounties/{id}/bets` | Bet history for a bounty |
| `GET` | `/bounties/{id}/payouts` | Payout records after resolution |
| `POST` | `/bets` | Place a YES or NO bet |
| `POST` | `/proof/upload` | Submit base64 photo proof |
| `GET` | `/proof/status/{bounty_id}` | Poll for AI verification result |
| `GET` | `/profile/{wallet}` | Stats: posted, fulfilled, bets won, P&L |
| `GET` | `/profile/{wallet}/activity` | Combined activity feed |
| `GET` | `/profile/{wallet}/bounties` | Bounties the user posted |
| `GET` | `/profile/{wallet}/bets` | Bets placed with outcomes |

---

## Example Bounties

- "I bet nobody brings me a kiwi in the next 30 minutes"
- "I bet nobody can solve this LeetCode Hard in 20 minutes"
- "I bet nobody finds me a USB-C charger in this building"

These aren't stock prices or sports scores — they're things that happen in the room. KiwiMarket turns any physical challenge into a tradeable market.

---

Built at YHack.
