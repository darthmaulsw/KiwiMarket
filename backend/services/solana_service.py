import os
import logging
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import Transaction
from solders.message import Message
from solana.rpc.api import Client

logger = logging.getLogger("kiwimarket")

SOLANA_RPC = os.getenv("SOLANA_RPC", "https://api.devnet.solana.com")


def _load_escrow_keypair() -> Keypair:
    raw = os.getenv("ESCROW_PRIVATE_KEY", "")
    if not raw:
        raise RuntimeError("ESCROW_PRIVATE_KEY not set in environment")
    # Accept base58-encoded 64-byte secret key
    import base58
    secret = base58.b58decode(raw)
    return Keypair.from_bytes(secret)


def send_sol(recipient_wallet: str, amount_sol: float) -> str:
    """
    Send `amount_sol` SOL from the escrow keypair to `recipient_wallet`.
    Returns the transaction signature string.
    """
    client = Client(SOLANA_RPC)
    escrow = _load_escrow_keypair()

    recipient = Pubkey.from_string(recipient_wallet)
    lamports = int(amount_sol * 1_000_000_000)

    ix = transfer(TransferParams(
        from_pubkey=escrow.pubkey(),
        to_pubkey=recipient,
        lamports=lamports,
    ))

    recent_blockhash_resp = client.get_latest_blockhash()
    recent_blockhash = recent_blockhash_resp.value.blockhash

    msg = Message.new_with_blockhash([ix], escrow.pubkey(), recent_blockhash)
    tx = Transaction([escrow], msg, recent_blockhash)

    resp = client.send_transaction(tx)
    sig = str(resp.value)
    logger.info("Sent %.4f SOL to %s, sig=%s", amount_sol, recipient_wallet, sig)
    return sig
