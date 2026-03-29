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
