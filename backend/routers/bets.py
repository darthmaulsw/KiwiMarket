from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Bet, Bounty
from schemas import BetCreate, BetOut

router = APIRouter(prefix="/bets", tags=["bets"])


@router.post("", response_model=BetOut, status_code=201)
def place_bet(payload: BetCreate, db: Session = Depends(get_db)):
    bounty = db.query(Bounty).filter(Bounty.id == payload.bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    if bounty.status != "open":
        raise HTTPException(status_code=400, detail=f"Bounty is {bounty.status}, not open")

    if payload.side == "YES":
        bounty.yes_pool += payload.amount_sol
    else:
        bounty.no_pool += payload.amount_sol

    bet = Bet(
        bounty_id=payload.bounty_id,
        bettor_wallet=payload.bettor_wallet,
        side=payload.side,
        amount_sol=payload.amount_sol,
        tx_signature=payload.tx_signature,
    )
    db.add(bet)
    db.commit()
    db.refresh(bet)
    return bet
