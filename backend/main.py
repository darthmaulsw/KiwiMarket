from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone

from database import engine, SessionLocal
from models import Base, Bounty
from routers import bounties, bets

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="KiwiMarket API", version="0.1.0")

# ─── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://heterotelic-haylee-nonepically.ngrok-free.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───────────────────────────────────────────────────────────────
app.include_router(bounties.router)
app.include_router(bets.router)


# ─── Seed data ─────────────────────────────────────────────────────────────
SEED_BOUNTIES = [
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


@app.on_event("startup")
def seed_demo_bounties():
    db = SessionLocal()
    try:
        existing = db.query(Bounty).count()
        if existing > 0:
            return  # Already seeded — don't duplicate on restart

        now = datetime.now(timezone.utc)
        for s in SEED_BOUNTIES:
            bounty = Bounty(
                title=s["title"],
                description=s["description"],
                reward_sol=s["reward_sol"],
                poster_wallet=s["poster_wallet"],
                expiry_at=now + timedelta(minutes=s["expiry_minutes"]),
                yes_pool=1.0,
                no_pool=1.0,
            )
            db.add(bounty)
        db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "ok", "app": "KiwiMarket API 🥝"}
