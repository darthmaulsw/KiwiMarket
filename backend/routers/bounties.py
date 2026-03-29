from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from database import get_db
from models import Bounty, Bet, Payout
from schemas import BountyCreate, BountyOut, BetFeedItem, PayoutOut

router = APIRouter(prefix="/bounties", tags=["bounties"])


def _attach_prices(bounty: Bounty) -> BountyOut:
    total = bounty.yes_pool + bounty.no_pool
    return BountyOut(
        id=bounty.id,
        title=bounty.title,
        description=bounty.description or "",
        reward_sol=bounty.reward_sol,
        yes_pool=bounty.yes_pool,
        no_pool=bounty.no_pool,
        yes_price=round(bounty.yes_pool / total, 4),
        no_price=round(bounty.no_pool / total, 4),
        poster_wallet=bounty.poster_wallet,
        fulfiller_wallet=bounty.fulfiller_wallet,
        status=bounty.status,
        expiry_at=bounty.expiry_at,
        created_at=bounty.created_at,
        tx_signature=bounty.tx_signature,
    )


def _expire_stale(db: Session) -> None:
    """Mark any open bounties past their expiry_at as expired."""
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


# ── IMPORTANT: /active must be declared before /{bounty_id} ──────────────

@router.get("/active", response_model=list[BountyOut])
def list_active_bounties(db: Session = Depends(get_db)):
    """Return only bounties that are open AND not yet past expiry.
    Also auto-expires any stale open bounties on each call."""
    _expire_stale(db)
    bounties = (
        db.query(Bounty)
        .filter(Bounty.status == "open")
        .order_by(Bounty.created_at.desc())
        .all()
    )
    return [_attach_prices(b) for b in bounties]


@router.get("", response_model=list[BountyOut])
def list_bounties(db: Session = Depends(get_db)):
    """Return all open bounties (no expiry filter — for backward compat)."""
    bounties = (
        db.query(Bounty)
        .filter(Bounty.status == "open")
        .order_by(Bounty.created_at.desc())
        .all()
    )
    return [_attach_prices(b) for b in bounties]


@router.get("/{bounty_id}", response_model=BountyOut)
def get_bounty(bounty_id: int, db: Session = Depends(get_db)):
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return _attach_prices(bounty)


@router.get("/{bounty_id}/bets", response_model=list[BetFeedItem])
def get_bounty_bets(bounty_id: int, db: Session = Depends(get_db)):
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    bets = (
        db.query(Bet)
        .filter(Bet.bounty_id == bounty_id)
        .order_by(Bet.created_at.desc())
        .all()
    )
    return bets


@router.get("/{bounty_id}/payouts", response_model=list[PayoutOut])
def get_bounty_payouts(bounty_id: int, db: Session = Depends(get_db)):
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return (
        db.query(Payout)
        .filter(Payout.bounty_id == bounty_id)
        .order_by(Payout.created_at.asc())
        .all()
    )


@router.post("", response_model=BountyOut, status_code=201)
def create_bounty(payload: BountyCreate, db: Session = Depends(get_db)):
    expiry = datetime.now(timezone.utc) + timedelta(minutes=payload.expiry_minutes)
    bounty = Bounty(
        title=payload.title,
        description=payload.description or "",
        reward_sol=payload.reward_sol,
        poster_wallet=payload.poster_wallet,
        expiry_at=expiry,
        tx_signature=payload.tx_signature,
    )
    db.add(bounty)
    db.commit()
    db.refresh(bounty)
    return _attach_prices(bounty)
