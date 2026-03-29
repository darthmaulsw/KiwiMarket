from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class Bounty(Base):
    __tablename__ = "bounties"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True, default="")
    reward_sol = Column(Float, nullable=False)
    yes_pool = Column(Float, nullable=False, default=1.0)
    no_pool = Column(Float, nullable=False, default=1.0)
    poster_wallet = Column(String, nullable=False)
    status = Column(String, nullable=False, default="open")  # open / fulfilled / expired / resolved
    expiry_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    tx_signature = Column(String, nullable=True)

    bets = relationship("Bet", back_populates="bounty", cascade="all, delete-orphan")


class Bet(Base):
    __tablename__ = "bets"

    id = Column(Integer, primary_key=True, index=True)
    bounty_id = Column(Integer, ForeignKey("bounties.id"), nullable=False)
    bettor_wallet = Column(String, nullable=False)
    side = Column(String, nullable=False)       # "YES" or "NO"
    amount_sol = Column(Float, nullable=False)
    tx_signature = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    bounty = relationship("Bounty", back_populates="bets")
