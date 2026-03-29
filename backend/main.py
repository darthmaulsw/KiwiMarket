import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone
from sqlalchemy import text

from database import engine, SessionLocal
from models import Base, Bounty
from routers import bounties, bets, proof, profile
from services.payout import resolve_expired_bounty

logger = logging.getLogger("kiwimarket")

# ─── Create / migrate tables ───────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

with engine.connect() as _conn:
    for col_sql in [
        "ALTER TABLE bets ADD COLUMN tx_signature VARCHAR",
        "ALTER TABLE bounties ADD COLUMN tx_signature VARCHAR",
        "ALTER TABLE bounties ADD COLUMN fulfiller_wallet VARCHAR",
    ]:
        try:
            _conn.execute(text(col_sql))
            _conn.commit()
        except Exception:
            pass  # Column already exists

# ─── App ───────────────────────────────────────────────────────────────────
app = FastAPI(title="KiwiMarket API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_origins=["https://heterotelic-haylee-nonepically.ngrok-free.dev"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bounties.router)
app.include_router(bets.router)
app.include_router(proof.router)
app.include_router(profile.router)


# ─── Background expiry task ────────────────────────────────────────────────

async def _expiry_loop() -> None:
    """Every 60 s: mark open bounties past expiry_at as expired."""
    while True:
        await asyncio.sleep(60)
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            stale = (
                db.query(Bounty)
                .filter(Bounty.status == "open", Bounty.expiry_at < now)
                .all()
            )
            for b in stale:
                b.status = "expired"
            if stale:
                db.commit()
                logger.info("Auto-expired %d bounties", len(stale))
                for b in stale:
                    try:
                        resolve_expired_bounty(b.id, db)
                    except Exception as exc:
                        logger.error("Expiry payout for bounty %d failed: %s", b.id, exc)
        except Exception as exc:
            logger.error("Expiry loop error: %s", exc)
        finally:
            db.close()


@app.on_event("startup")
async def startup() -> None:
    # Seed demo bounties (once)
    db = SessionLocal()
    try:
        if db.query(Bounty).count() == 0:
            now = datetime.now(timezone.utc)
            seed = [
                {
                    "title": "I bet nobody brings me a kiwi in the next 30 minutes 🥝",
                    "description": "Deliver a fresh kiwi fruit to my location. I'll share coordinates on Discord after you accept.",
                    "reward_sol": 0.2,
                    "expiry_minutes": 30,
                    "poster_wallet": "Demo1111111111111111111111111111111111111111",
                },
                {
                    "title": "I bet nobody can solve this LeetCode Hard in 20 minutes 💻",
                    "description": "Serialize and Deserialize Binary Tree (LC #297). Screen share required. Submit a working solution on LeetCode.",
                    "reward_sol": 0.5,
                    "expiry_minutes": 20,
                    "poster_wallet": "Demo2222222222222222222222222222222222222222",
                },
                {
                    "title": "I bet nobody finds me a phone charger within 10 minutes 🔌",
                    "description": "USB-C preferred. Must be usable right now, in this building. Send a photo as proof.",
                    "reward_sol": 0.15,
                    "expiry_minutes": 10,
                    "poster_wallet": "Demo3333333333333333333333333333333333333333",
                },
            ]
            for s in seed:
                db.add(Bounty(
                    title=s["title"],
                    description=s["description"],
                    reward_sol=s["reward_sol"],
                    poster_wallet=s["poster_wallet"],
                    expiry_at=now + timedelta(minutes=s["expiry_minutes"]),
                ))
            db.commit()
    finally:
        db.close()

    # Start background expiry loop
    asyncio.create_task(_expiry_loop())


@app.get("/")
def root():
    return {"status": "ok", "app": "KiwiMarket API 🥝"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=False)
