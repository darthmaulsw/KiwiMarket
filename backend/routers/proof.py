from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db
from models import Bounty, Proof, Payout
from schemas import ProofUpload, ProofOut, PayoutOut
from services.ai_verification import verify_proof
from services.payout import resolve_bounty

router = APIRouter(prefix="/proof", tags=["proof"])


def _run_verification(proof_id: int, bounty_id: int, db_factory) -> None:
    """Background task: verify proof with Claude, then resolve bounty if YES."""
    db: Session = db_factory()
    try:
        proof = db.query(Proof).filter(Proof.id == proof_id).first()
        if not proof:
            return

        bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            return

        result = verify_proof(
            image_base64=proof.image_base64,
            bounty_title=bounty.title,
            bounty_description=bounty.description or "",
        )

        proof.verdict = result["verdict"]
        proof.reasoning = result["reasoning"]

        if result["verdict"] == "YES":
            proof.status = "verified"
            db.commit()
            resolve_bounty(bounty_id, proof, db)
        else:
            proof.status = "rejected"
            db.commit()

    except Exception as exc:
        import logging
        logging.getLogger("kiwimarket").error("Background verification error: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/upload", response_model=ProofOut, status_code=202)
def upload_proof(
    payload: ProofUpload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    bounty = db.query(Bounty).filter(Bounty.id == payload.bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    if bounty.status != "open":
        raise HTTPException(status_code=409, detail=f"Bounty is {bounty.status}, not open")

    proof = Proof(
        bounty_id=payload.bounty_id,
        fulfiller_wallet=payload.fulfiller_wallet,
        image_base64=payload.image_base64,
        status="pending",
    )
    db.add(proof)
    db.commit()
    db.refresh(proof)

    from database import SessionLocal
    background_tasks.add_task(_run_verification, proof.id, payload.bounty_id, SessionLocal)

    return ProofOut(proof_id=proof.id, status=proof.status)


@router.get("/status/{bounty_id}", response_model=ProofOut)
def get_proof_status(bounty_id: int, db: Session = Depends(get_db)):
    proof = (
        db.query(Proof)
        .filter(Proof.bounty_id == bounty_id)
        .order_by(Proof.created_at.desc())
        .first()
    )
    if not proof:
        raise HTTPException(status_code=404, detail="No proof submitted yet")

    return ProofOut(
        proof_id=proof.id,
        status=proof.status,
        verdict=proof.verdict,
        reasoning=proof.reasoning,
    )
