from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ─── Bounty ────────────────────────────────────────────────────────────────

class BountyCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    reward_sol: float = Field(gt=0)
    expiry_minutes: int = Field(gt=0, default=60)
    poster_wallet: str


class BountyOut(BaseModel):
    id: int
    title: str
    description: str
    reward_sol: float
    yes_pool: float
    no_pool: float
    yes_price: float          # computed: yes_pool / (yes_pool + no_pool)
    no_price: float           # computed: no_pool  / (yes_pool + no_pool)
    poster_wallet: str
    status: str
    expiry_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Bet ───────────────────────────────────────────────────────────────────

class BetCreate(BaseModel):
    bounty_id: int
    bettor_wallet: str
    side: str = Field(pattern="^(YES|NO)$")
    amount_sol: float = Field(gt=0)


class BetOut(BaseModel):
    id: int
    bounty_id: int
    bettor_wallet: str
    side: str
    amount_sol: float
    created_at: datetime

    model_config = {"from_attributes": True}
