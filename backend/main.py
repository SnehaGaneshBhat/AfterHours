
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "amazon.nova-lite-v1:0",
)

DECIDER_URL = os.getenv(
    "DECIDER_URL",
    "http://127.0.0.1:8001/v1/systemone",
)

DECIDER_MODEL_ID = "strands-decider-2B-hobson-v19"

DIRECTOR_ACTIONS = {
    "HINT": "Give a useful hint about evidence already discovered.",
    "RAISE_TENSION": "Increase suspense without changing game mechanics.",
    "OPEN_SHORTCUT": "Offer an alternate route only when the game engine permits it.",
    "WAIT": "Take no intervention; let the player continue exploring.",
}

app = FastAPI(
    title="AFTERHOURS API",
    description="Backend for the AFTERHOURS narrative experiment.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=AWS_REGION,
)


class NarrationRequest(BaseModel):
    room_name: str = Field(min_length=1, max_length=100)
    event: str = Field(min_length=1, max_length=300)
    verified_facts: list[str] = Field(max_length=10)


class NarrationResponse(BaseModel):
    narration: str
    model: str
    source: str = "amazon-bedrock"

class DirectorDecisionRequest(BaseModel):
    state: str = Field(min_length=1, max_length=3000)
    allowed_actions: list[str] = Field(min_length=1, max_length=4)


class DirectorDecisionResponse(BaseModel):
    action: str
    confidence: float | None = None
    probabilities: dict[str, float] = Field(default_factory=dict)
    model: str
    latency_ms: float | None = None
    source: str = "strands-decider-2B"

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "service": "AFTERHOURS API",
    }


@app.post("/api/director/narrate", response_model=NarrationResponse)
def narrate(request: NarrationRequest):
    facts = "\n".join(
        f"- {fact[:300]}" for fact in request.verified_facts
    )

    prompt = f"""
You are the narrative voice of AFTERHOURS, a tense science-fiction
mystery set inside a research facility.

The game engine, not you, controls all game mechanics.

CURRENT ROOM:
{request.room_name}

LATEST VERIFIED GAME EVENT:
{request.event}

VERIFIED FACTS:
{facts or "- No additional facts supplied."}

RULES:
- Write 2 to 4 concise sentences of atmospheric narrative.
- Stay consistent with the supplied event and verified facts.
- Do not invent clues, evidence, access codes, or player actions.
- Do not claim a door opened or a puzzle was solved unless the
  supplied facts explicitly establish that.
- Never decide game rules or change the game state.
- Use restrained, unsettling science-fiction thriller prose.
- Return only the narrative text.
""".strip()

    try:
        response = bedrock.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=[
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ],
            inferenceConfig={
                "maxTokens": 180,
                "temperature": 0.6,
            },
        )

        content = response["output"]["message"]["content"]
        narration = "\n".join(
            item["text"] for item in content if "text" in item
        ).strip()

        if not narration:
            raise HTTPException(
                status_code=502,
                detail="The narrative model returned an empty response.",
            )

        return NarrationResponse(
            narration=narration,
            model=BEDROCK_MODEL_ID,
        )

    except HTTPException:
        raise
    except (BotoCoreError, ClientError) as exc:
        print(f"Bedrock request failed: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Narrative generation failed. Check backend logs.",
        ) from exc

@app.post(
    "/api/director/decide",
    response_model=DirectorDecisionResponse,
)
def decide(request: DirectorDecisionRequest):
    allowed = list(dict.fromkeys(request.allowed_actions))

    if any(action not in DIRECTOR_ACTIONS for action in allowed):
        raise HTTPException(
            status_code=400,
            detail="One or more Director actions are invalid.",
        )

    if not allowed:
        raise HTTPException(
            status_code=400,
            detail="At least one permitted action is required.",
        )

    criteria = {
        action: DIRECTOR_ACTIONS[action]
        for action in allowed
    }

    payload = {
        "state": request.state,
        "model": DECIDER_MODEL_ID,
        "questions": {
            "director_action": {
                "type": "choice",
                "instructions": (
                    "Choose the most appropriate permitted Director "
                    "action for the current game state. Do not invent "
                    "evidence or change game mechanics. Choose only "
                    "from the provided criteria."
                ),
                "criteria": criteria,
            }
        },
    }

    http_request = Request(
        DECIDER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        # Local CPU inference can take tens of seconds.
        with urlopen(http_request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))

    except HTTPError as exc:
        print(f"Decider HTTP error: {exc.code}")
        raise HTTPException(
            status_code=502,
            detail="The Director decision service returned an error.",
        ) from exc

    except (URLError, TimeoutError, OSError) as exc:
        print(f"Decider connection failed: {type(exc).__name__}")
        raise HTTPException(
            status_code=504,
            detail="The Director decision service is unavailable or timed out.",
        ) from exc

    answer = result.get("answers", {}).get("director_action", {})
    proposed_action = answer.get("choice")

    # Defense in depth: never return an action the caller did not permit.
    if proposed_action not in allowed:
        raise HTTPException(
            status_code=502,
            detail="The Decider returned an action that was not permitted.",
        )
    else:
        confidence = answer.get("confidence")
        probabilities = answer.get("probabilities") or {}

    if not isinstance(probabilities, dict):
        probabilities = {}

    return DirectorDecisionResponse(
        action=proposed_action,
        confidence=confidence,
        probabilities=probabilities,
        model=result.get("model", DECIDER_MODEL_ID),
        latency_ms=result.get("latency_ms"),
    )
    
