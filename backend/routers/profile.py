from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Bounty, Bet, Proof, Payout
from schemas import (
    ProfileStats, ProfileBountyItem, ProfileBetItem,
    ProfileFulfilledItem, ActivityItem,
)

router = APIRouter(prefix="/profile", tags=["profile"])


def _bet_outcome(bet: Bet) -> str:
    status = bet.bounty.status if bet.bounty else "unknown"
    if status == "open":
        return "pending"
    if status in ("fulfilled", "resolved"):
        return "won" if bet.side == "YES" else "lost"
    if status == "expired":
        return "expired"
    return "pending"


# ── GET /profile/{wallet} — stats ──────────────────────────────────────────

@router.get("/{wallet_address}", response_model=ProfileStats)
def get_profile_stats(wallet_address: str, db: Session = Depends(get_db)):
    bounties_posted = db.query(Bounty).filter(
        Bounty.poster_wallet == wallet_address
    ).count()

    bounties_fulfilled = db.query(Bounty).filter(
        Bounty.fulfiller_wallet == wallet_address
    ).count()

    bets = (
        db.query(Bet)
        .filter(Bet.bettor_wallet == wallet_address)
        .all()
    )
    bets_total = len(bets)
    bets_won = sum(
        1 for b in bets
        if b.bounty and b.bounty.status in ("fulfilled", "resolved") and b.side == "YES"
    )

    total_earned_sol = db.query(func.sum(Payout.amount_sol)).filter(
        Payout.recipient_wallet == wallet_address
    ).scalar() or 0.0

    bet_spent = db.query(func.sum(Bet.amount_sol)).filter(
        Bet.bettor_wallet == wallet_address
    ).scalar() or 0.0

    bounty_spent = db.query(func.sum(Bounty.reward_sol)).filter(
        Bounty.poster_wallet == wallet_address
    ).scalar() or 0.0

    total_spent_sol = bet_spent + bounty_spent
    net_pnl_sol = total_earned_sol - total_spent_sol

    return ProfileStats(
        bounties_posted=bounties_posted,
        bounties_fulfilled=bounties_fulfilled,
        bets_won=bets_won,
        bets_total=bets_total,
        total_earned_sol=round(total_earned_sol, 9),
        total_spent_sol=round(total_spent_sol, 9),
        net_pnl_sol=round(net_pnl_sol, 9),
    )


# ── GET /profile/{wallet}/bounties ─────────────────────────────────────────

@router.get("/{wallet_address}/bounties", response_model=list[ProfileBountyItem])
def get_profile_bounties(wallet_address: str, db: Session = Depends(get_db)):
    bounties = (
        db.query(Bounty)
        .filter(Bounty.poster_wallet == wallet_address)
        .order_by(Bounty.created_at.desc())
        .all()
    )
    result = []
    for b in bounties:
        bet_count = db.query(Bet).filter(Bet.bounty_id == b.id).count()
        result.append(ProfileBountyItem(
            id=b.id,
            title=b.title,
            reward_sol=b.reward_sol,
            status=b.status,
            expiry_at=b.expiry_at,
            bet_count=bet_count,
            created_at=b.created_at,
        ))
    return result


# ── GET /profile/{wallet}/bets ─────────────────────────────────────────────

@router.get("/{wallet_address}/bets", response_model=list[ProfileBetItem])
def get_profile_bets(wallet_address: str, db: Session = Depends(get_db)):
    bets = (
        db.query(Bet)
        .filter(Bet.bettor_wallet == wallet_address)
        .order_by(Bet.created_at.desc())
        .all()
    )
    result = []
    for bet in bets:
        bounty = bet.bounty
        outcome = _bet_outcome(bet)
        payout_sol = 0.0
        if outcome == "won":
            payout_sol = db.query(func.sum(Payout.amount_sol)).filter(
                Payout.bounty_id == bet.bounty_id,
                Payout.recipient_wallet == wallet_address,
            ).scalar() or 0.0
        result.append(ProfileBetItem(
            id=bet.id,
            bounty_id=bet.bounty_id,
            bounty_title=bounty.title if bounty else "Unknown",
            side=bet.side,
            amount_sol=bet.amount_sol,
            outcome=outcome,
            payout_sol=round(payout_sol, 9),
            tx_signature=bet.tx_signature,
            created_at=bet.created_at,
        ))
    return result


# ── GET /profile/{wallet}/fulfilled ────────────────────────────────────────

@router.get("/{wallet_address}/fulfilled", response_model=list[ProfileFulfilledItem])
def get_profile_fulfilled(wallet_address: str, db: Session = Depends(get_db)):
    bounties = (
        db.query(Bounty)
        .filter(
            Bounty.fulfiller_wallet == wallet_address,
            Bounty.status == "fulfilled",
        )
        .order_by(Bounty.created_at.desc())
        .all()
    )
    result = []
    for b in bounties:
        proof = (
            db.query(Proof)
            .filter(Proof.bounty_id == b.id, Proof.status == "verified")
            .first()
        )
        result.append(ProfileFulfilledItem(
            bounty_id=b.id,
            title=b.title,
            reward_sol=b.reward_sol,
            reasoning=proof.reasoning if proof else None,
            fulfilled_at=proof.created_at if proof else b.created_at,
        ))
    return result


# ── GET /profile/{wallet}/activity ─────────────────────────────────────────

@router.get("/{wallet_address}/activity", response_model=list[ActivityItem])
def get_profile_activity(wallet_address: str, db: Session = Depends(get_db)):
    items: list[ActivityItem] = []

    # Bounties posted
    for b in db.query(Bounty).filter(Bounty.poster_wallet == wallet_address).all():
        items.append(ActivityItem(
            type="bounty_posted",
            title=b.title,
            amount_sol=b.reward_sol,
            is_debit=True,
            tx_signature=b.tx_signature,
            created_at=b.created_at,
        ))

    # Bets placed
    for bet in db.query(Bet).filter(Bet.bettor_wallet == wallet_address).all():
        bounty = bet.bounty
        items.append(ActivityItem(
            type="bet_yes" if bet.side == "YES" else "bet_no",
            title=bounty.title if bounty else "Unknown bounty",
            amount_sol=bet.amount_sol,
            is_debit=True,
            tx_signature=bet.tx_signature,
            created_at=bet.created_at,
        ))

    # Payouts received
    for p in db.query(Payout).filter(Payout.recipient_wallet == wallet_address).all():
        bounty = db.query(Bounty).filter(Bounty.id == p.bounty_id).first()
        is_fulfiller = bounty and bounty.fulfiller_wallet == wallet_address
        items.append(ActivityItem(
            type="fulfilled" if is_fulfiller else "payout",
            title=bounty.title if bounty else "Unknown bounty",
            amount_sol=p.amount_sol,
            is_debit=False,
            tx_signature=p.tx_signature,
            created_at=p.created_at,
        ))

    items.sort(key=lambda x: x.created_at, reverse=True)
    return items
