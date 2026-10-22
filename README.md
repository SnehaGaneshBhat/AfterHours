# AFTERHOURS

**The light is still on. The access log says you were here before you arrived.**

A supernatural investigation game powered by Amazon Bedrock and Strands Decider 2B.

You have arrived at a remote lighthouse facility operated by a covert organization that studies people with extraordinary abilities. Something is wrong. An access record places you inside the facility before you arrived.

Your task is to investigate the facility, examine evidence, solve its puzzles, and uncover what happened.

But the facility isn't the only thing responding to you.

An AI director observes your progress and chooses when to offer assistance, when to intensify the atmosphere, and when to let the silence continue.

**The objective isn't to make the AI solve the mystery. It's to make the mystery respond to the player.**
![AFTERHOURS landing screen](docs/images/afterhours-gameplay.png)

---

## The Experience

AFTERHOURS combines a playable investigation with bounded, context-aware AI decisions.

- **Explore a mysterious facility.** Progress through locations including the gates, lighthouse, surveillance archive, and records centre.
- **Investigate evidence.** Examine records and environmental clues to reconstruct an impossible sequence of events.
- **Solve puzzles.** Discover the information needed to advance rather than relying on an AI-generated answer.
- **Experience an adaptive atmosphere.** The AI director can choose between offering a hint, raising tension, or waiting.
- **Reach an evidence-based conclusion.** Your collected evidence informs the ending of your investigation.

## Why Strands Decider 2B?

Many AI-powered games use language models primarily to generate dialogue. AFTERHOURS explores a different role: **using an AI model to choose how the experience should respond to the player.**

Strands Decider 2B is used to select among a small set of predefined interventions:

| Decision | Intended effect |
|---|---|
| `HINT` | Offer contextual assistance when the player needs direction. |
| `RAISE_TENSION` | Intensify the experience without handing over the solution. |
| `WAIT` | Leave the player to investigate without unnecessary intervention. |

The director's decision is informed by available game context, such as player progress and interaction patterns.

Amazon Bedrock supports the narrative-generation component, allowing the game to deliver atmospheric responses grounded in verified game information.

The result is a separation between **deciding how to respond** and **determining what is true in the game**.

## Architecture

```text
Player interaction
        |
        v
Deterministic game state
        |
        v
Strands Decider 2B
        |
        v
Validated intervention
   /       |        \
 HINT   RAISE_TENSION  WAIT
   \       |        /
        v
Game response
        |
        v
Amazon Bedrock
        |
        v
Context-grounded narration
```

The director does not own the game's underlying truth.

- **Deterministic game logic** controls puzzle validation, evidence collection, and progression.
- **Strands Decider 2B** chooses from a constrained set of interventions.
- **Decision validation** restricts the response to supported actions and provides a fallback for invalid output.
- **Amazon Bedrock** supports narrative generation based on the verified game context.
- **The frontend** presents the investigation, puzzle interactions, evidence, and resulting responses.

This division is intentional. The AI can influence the experience without being allowed to invent evidence, bypass puzzle requirements, or independently advance the investigation.

## A Reusable Pattern: The Constrained AI Director

AFTERHOURS demonstrates a reusable pattern for interactive AI applications:

1. **Observe:** Gather relevant, verified application state.
2. **Decide:** Ask the model to choose among a predefined set of actions.
3. **Validate:** Check the proposed decision against the application's allowed actions.
4. **Execute:** Let deterministic application logic apply the permitted effect.
5. **Narrate:** Generate an appropriate response grounded in the resulting state.

This pattern is useful when an application benefits from adaptive AI behavior but cannot safely delegate its core rules to a model.

Potential applications include adaptive game difficulty, interactive storytelling, tutoring systems, guided simulations, and context-sensitive assistance.

## Technology Stack

- **Strands Decider 2B** — constrained intervention selection
- **Amazon Bedrock** — AI-powered narrative generation
- **Python / FastAPI** — backend services
- **React / Vite** — interactive frontend
- **JavaScript** — frontend game interactions and state presentation

## Running Locally

### Prerequisites

- Python and Node.js installed
- AWS credentials configured for an account with access to the required Amazon Bedrock model
- The Strands Decider 2B model and its required dependencies available according to the project's configuration

> **Hardware note:** Running Strands Decider 2B locally on CPU can require substantial memory. A machine with limited RAM may struggle. Use an appropriately provisioned machine or a supported remote setup for the director service.

### 1. Clone the repository

```bash
git clone https://github.com/SnehaGaneshBhat/AfterHours.git
cd AfterHours
```

### 2. Configure the backend

```bash
cd backend
python -m venv .venv
```

Activate the environment.

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the project dependencies:

```bash
pip install -r requirements.txt
```

If your setup requires the separate Decider dependency set, consult `requirements-decider.txt` and the project's configuration before installing it.

Configure the backend environment using `.env.example` as a reference. Set the AWS region, credentials, model configuration, and any required Decider service settings. Do not commit secrets or real credentials.

Start the backend from the `backend` directory:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 3. Configure the frontend

In a second terminal:

```bash
cd frontend
npm install
```

Configure the frontend using its `.env.example` file, including the backend API origin if required by your setup.

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite.

**Note:** Exact environment-variable names and model requirements are defined by the current project configuration. A successful frontend launch alone does not verify that the Decider and Bedrock integrations are operational.

## Testing

From the `frontend` directory:

```bash
npm test
npm run lint
npm run build
```

These checks cover the frontend test suite, linting, and production build. They do not by themselves establish that a live AWS request, local Decider inference, or a complete browser playthrough succeeds.

## Project Structure

```text
AfterHours/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── requirements-decider.txt
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── .env.example
├── LICENSE
└── README.md
```

## Hackathon

Built for the AWS Agent Experience Hackathon, exploring policy-based intervention selection with Strands Decider 2B and Amazon Bedrock.

**Tags:** `#strands-decider-2b` `#policy`

## License

The original project source code is licensed under the [Zero-Clause BSD (0BSD) License](LICENSE).

The game's visual artwork was generated using OpenAI's image-generation tools for this project. Third-party libraries, models, and other dependencies remain subject to their respective licenses and terms.

---

*The investigation is yours. Deciding when to intervene is the agent's.*
