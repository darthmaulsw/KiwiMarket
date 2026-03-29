import logging
from sqlalchemy.orm import Session

from models import Bounty, Bet, Proof, Payout
from services.solana_service import send_sol

logger = logging.getLogger("kiwimarket")

# Platform fee (5%)
PLATFORM_FEE = 0.05


def resolve_bounty(bounty_id: int, proof: Proof, db: Session) -> None:
    """
    Called after a proof is verified (verdict == YES).
    Distributes SOL from the escrow:
      - fulfiller gets the reward_sol (minus platform fee)
      - YES bettors get their proportional share of the NO pool
    Updates bounty status to 'fulfilled' and records Payout rows.
    """
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        logger.error("resolve_bounty: bounty %d not found", bounty_id)
        return

    if bounty.status != "open":
        logger.warning("resolve_bounty: bounty %d is already %s", bounty_id, bounty.status)
        return

    # ── 1. Fulfiller payout ──────────────────────────────────────────────────
    fulfiller_amount = round(bounty.reward_sol * (1 - PLATFORM_FEE), 9)
    fulfiller_wallet = proof.fulfiller_wallet

    try:
        sig = send_sol(fulfiller_wallet, fulfiller_amount)
    except Exception as exc:
        logger.error("Payout to fulfiller failed: %s", exc)
        sig = None

    db.add(Payout(
        bounty_id=bounty_id,
        recipient_wallet=fulfiller_wallet,
        amount_sol=fulfiller_amount,
        tx_signature=sig,
    ))

    # ── 2. YES bettor payouts ────────────────────────────────────────────────
    yes_bets = (
        db.query(Bet)
        .filter(Bet.bounty_id == bounty_id, Bet.side == "YES")
        .all()
    )
    no_pool = bounty.no_pool
    yes_pool = bounty.yes_pool

    for bet in yes_bets:
        if yes_pool == 0:
            break
        share = bet.amount_sol / yes_pool
        winnings = round(bet.amount_sol + share * no_pool * (1 - PLATFORM_FEE), 9)
        try:
            bet_sig = send_sol(bet.bettor_wallet, winnings)
        except Exception as exc:
            logger.error("Payout to bettor %s failed: %s", bet.bettor_wallet, exc)
            bet_sig = None

        db.add(Payout(
            bounty_id=bounty_id,
            recipient_wallet=bet.bettor_wallet,
            amount_sol=winnings,
            tx_signature=bet_sig,
        ))

    # ── 3. Update bounty + proof state ─────────────────────────────────────
    bounty.status = "fulfilled"
    bounty.fulfiller_wallet = fulfiller_wallet
    proof.status = "verified"

    db.commit()
    logger.info("Bounty %d resolved. Fulfiller=%s amount=%.4f SOL",
                bounty_id, fulfiller_wallet, fulfiller_amount)


def resolve_expired_bounty(bounty_id: int, db: Session) -> None:
    """
    Called when a bounty expires unfulfilled.
    - Poster gets their reward_sol refunded in full.
    - NO bettors get their stake back + proportional share of the YES pool (5% fee on winnings).
    - YES bettors lose their stake.
    Bounty status is updated to 'resolved'.
    """
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        return
    if bounty.status != "expired":
        return

    # Guard: don't double-pay if payouts already exist
    if db.query(Payout).filter(Payout.bounty_id == bounty_id).count() > 0:
        bounty.status = "resolved"
        db.commit()
        return

    # ── 1. Refund poster ────────────────────────────────────────────────────
    try:
        sig = send_sol(bounty.poster_wallet, bounty.reward_sol)
    except Exception as exc:
        logger.error("Expiry refund to poster failed: %s", exc)
        sig = None

    db.add(Payout(
        bounty_id=bounty_id,
        recipient_wallet=bounty.poster_wallet,
        amount_sol=bounty.reward_sol,
        tx_signature=sig,
    ))

    # ── 2. Pay NO bettors (stake + share of YES pool) ───────────────────────
    no_bets = db.query(Bet).filter(Bet.bounty_id == bounty_id, Bet.side == "NO").all()
    yes_bets = db.query(Bet).filter(Bet.bounty_id == bounty_id, Bet.side == "YES").all()

    no_pool = sum(b.amount_sol for b in no_bets)
    yes_pool = sum(b.amount_sol for b in yes_bets)

    for bet in no_bets:
        if no_pool == 0:
            break
        share = bet.amount_sol / no_pool
        winnings = round(bet.amount_sol + share * yes_pool * (1 - PLATFORM_FEE), 9)
        try:
            bet_sig = send_sol(bet.bettor_wallet, winnings)
        except Exception as exc:
            logger.error("Expiry payout to NO bettor %s failed: %s", bet.bettor_wallet, exc)
            bet_sig = None

        db.add(Payout(
            bounty_id=bounty_id,
            recipient_wallet=bet.bettor_wallet,
            amount_sol=winnings,
            tx_signature=bet_sig,
        ))

    # ── 3. Mark resolved ────────────────────────────────────────────────────
    bounty.status = "resolved"
    db.commit()
    logger.info(
        "Expired bounty %d resolved. Refunded poster %s (%.4f SOL), paid %d NO bettors",
        bounty_id, bounty.poster_wallet, bounty.reward_sol, len(no_bets),
    )
