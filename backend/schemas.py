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
    tx_signature: Optional[str] = None


class BountyOut(BaseModel):
    id: int
    title: str
    description: str
    reward_sol: float
    yes_pool: float
    no_pool: float
    yes_price: float
    no_price: float
    poster_wallet: str
    fulfiller_wallet: Optional[str] = None
    status: str
    expiry_at: datetime
    created_at: datetime
    tx_signature: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Bet ───────────────────────────────────────────────────────────────────

class BetCreate(BaseModel):
    bounty_id: int
    bettor_wallet: str
    side: str = Field(pattern="^(YES|NO)$")
    amount_sol: float = Field(gt=0)
    tx_signature: Optional[str] = None


class BetOut(BaseModel):
    id: int
    bounty_id: int
    bettor_wallet: str
    side: str
    amount_sol: float
    tx_signature: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BetFeedItem(BaseModel):
    id: int
    bettor_wallet: str
    side: str
    amount_sol: float
    tx_signature: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Proof ─────────────────────────────────────────────────────────────────

class ProofUpload(BaseModel):
    bounty_id: int
    fulfiller_wallet: str
    image_base64: str


class ProofOut(BaseModel):
    proof_id: int
    status: str
    verdict: Optional[str] = None
    reasoning: Optional[str] = None


# ─── Payout ────────────────────────────────────────────────────────────────

class PayoutOut(BaseModel):
    id: int
    recipient_wallet: str
    amount_sol: float
    tx_signature: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Profile ────────────────────────────────────────────────────────────────

class ProfileStats(BaseModel):
    bounties_posted: int
    bounties_fulfilled: int
    bets_won: int
    bets_total: int
    total_earned_sol: float
    total_spent_sol: float
    net_pnl_sol: float


class ProfileBountyItem(BaseModel):
    id: int
    title: str
    reward_sol: float
    status: str
    expiry_at: datetime
    bet_count: int
    created_at: datetime


class ProfileBetItem(BaseModel):
    id: int
    bounty_id: int
    bounty_title: str
    side: str
    amount_sol: float
    outcome: str       # won / lost / pending / expired
    payout_sol: float
    tx_signature: Optional[str] = None
    created_at: datetime


class ProfileFulfilledItem(BaseModel):
    bounty_id: int
    title: str
    reward_sol: float
    reasoning: Optional[str] = None
    fulfilled_at: datetime


class ActivityItem(BaseModel):
    type: str          # bounty_posted / bet_yes / bet_no / payout / fulfilled
    title: str
    amount_sol: float
    is_debit: bool
    tx_signature: Optional[str] = None
    created_at: datetime
