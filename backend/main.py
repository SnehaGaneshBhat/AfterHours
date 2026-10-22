
import json
import math
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
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

DIRECTOR_ACTIONS = {
    "HINT": "Offer a context-appropriate hint using only verified game facts.",
    "RAISE_TENSION": "Increase suspense without changing game mechanics.",
    "WAIT": "Take no intervention; let the player continue exploring.",
}

app = FastAPI(
    title="AFTERHOURS API",
    description="Backend for the AFTERHOURS narrative experiment.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
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
    recent_narration: list[str] = Field(default_factory=list, max_length=4)


class NarrationResponse(BaseModel):
    narration: str
    model: str
    source: str = "amazon-bedrock"

class DirectorDecisionRequest(BaseModel):
    state: str = Field(min_length=1, max_length=3000)
    allowed_actions: list[str] = Field(min_length=1, max_length=3)


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
    recent_narration = "\n".join(
        f"- {line[:300]}" for line in request.recent_narration[-4:]
    )
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

RECENT NARRATION FOR CONTINUITY:
{recent_narration or "- This is the opening narration."}

RULES:
- Write 2 to 4 concise sentences of atmospheric narrative.
- Stay consistent with the supplied event and verified facts.
- Treat recent narration as continuity context only; verified facts are the only source of game state.
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

        try:
            content = response["output"]["message"]["content"]
        except (KeyError, TypeError):
            raise HTTPException(
                status_code=502,
                detail="The narrative model returned a malformed response.",
            ) from None
        if not isinstance(content, list):
            raise HTTPException(
                status_code=502,
                detail="The narrative model returned a malformed response.",
            )
        narration = "\n".join(
            item["text"]
            for item in content
            if isinstance(item, dict) and isinstance(item.get("text"), str)
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
        print(f"Bedrock request failed: {type(exc).__name__}")
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

    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        print(f"Decider response parsing failed: {type(exc).__name__}")
        raise HTTPException(
            status_code=502,
            detail="The Director decision service returned malformed JSON.",
        ) from exc

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502,
            detail="The Decider returned a malformed response.",
        )

    answers = result.get("answers")
    answer = answers.get("director_action") if isinstance(answers, dict) else None
    if not isinstance(answer, dict):
        raise HTTPException(
            status_code=502,
            detail="The Decider response did not contain a valid action answer.",
        )

    proposed_action = answer.get("choice")

    # Defense in depth: never return an action the caller did not permit.
    if proposed_action not in allowed:
        raise HTTPException(
            status_code=502,
            detail="The Decider returned an action that was not permitted.",
        )
    confidence = answer.get("confidence")
    if (
        isinstance(confidence, bool)
        or not isinstance(confidence, (int, float))
        or not math.isfinite(confidence)
    ):
        confidence = None

    raw_probabilities = answer.get("probabilities")
    probabilities = {}
    if isinstance(raw_probabilities, dict):
        probabilities = {
            action: value
            for action, value in raw_probabilities.items()
            if isinstance(action, str)
            and not isinstance(value, bool)
            and isinstance(value, (int, float))
            and math.isfinite(value)
        }

    model = result.get("model", DECIDER_MODEL_ID)
    if not isinstance(model, str):
        model = DECIDER_MODEL_ID
    latency_ms = result.get("latency_ms")
    if (
        isinstance(latency_ms, bool)
        or not isinstance(latency_ms, (int, float))
        or not math.isfinite(latency_ms)
    ):
        latency_ms = None

    return DirectorDecisionResponse(
        action=proposed_action,
        confidence=confidence,
        probabilities=probabilities,
        model=model,
        latency_ms=latency_ms,
    )
    
