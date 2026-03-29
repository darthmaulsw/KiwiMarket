import os
import json
import logging
import anthropic

logger = logging.getLogger("kiwimarket")

PROMPT_TEMPLATE = """You are verifying photo proof for a real-world bounty challenge.

Bounty: "{title}"
Description: "{description}"

Look at the attached image and determine: does this photo provide clear visual evidence that the bounty has been fulfilled?

Reply in this exact JSON format:
{{
  "verdict": "YES" or "NO",
  "reasoning": "One sentence explaining your decision."
}}

Be strict but fair. The evidence must be clear and directly related to the bounty requirement."""


def verify_proof(image_base64: str, bounty_title: str, bounty_description: str) -> dict:
    """
    Send image to Claude vision API and return { verdict, reasoning }.
    On any failure, returns a safe NO verdict.
    """
    try:
        # Strip data-URL prefix if present (e.g. "data:image/jpeg;base64,...")
        media_type = "image/jpeg"
        data = image_base64
        if image_base64.startswith("data:"):
            header, data = image_base64.split(",", 1)
            # header = "data:image/jpeg;base64"
            mt = header.split(";")[0].split(":")[1]
            if mt in ("image/jpeg", "image/png", "image/gif", "image/webp"):
                media_type = mt

        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": data,
                            },
                        },
                        {
                            "type": "text",
                            "text": PROMPT_TEMPLATE.format(
                                title=bounty_title,
                                description=bounty_description,
                            ),
                        },
                    ],
                }
            ],
        )

        raw = message.content[0].text.strip()
        logger.info("Claude raw response: %s", raw)

        # Extract JSON — Claude may wrap it in a code block
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw)
        verdict = result.get("verdict", "NO").upper()
        reasoning = result.get("reasoning", "No reasoning provided.")

        if verdict not in ("YES", "NO"):
            verdict = "NO"

        return {"verdict": verdict, "reasoning": reasoning}

    except Exception as exc:
        logger.error("AI verification failed: %s", exc)
        return {
            "verdict": "NO",
            "reasoning": "Verification service unavailable — please try again.",
        }
