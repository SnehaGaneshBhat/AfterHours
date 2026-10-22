# Reusable constrained Director pattern

1. **Problem:** request a bounded pacing choice without handing game rules to a model.
2. **Inputs:** verified room facts, recent narration for continuity, and player telemetry.
3. **Selection:** `requestConstrainedDirectorDecision` calls the existing `/api/director/decide` route.
4. **Allowlist:** only `HINT`, `RAISE_TENSION`, and `WAIT` are accepted; malformed actions are rejected.
5. **Metadata:** only fields actually returned by the API are retained; unavailable values remain absent.
6. **Application:** game-specific code maps the validated action to its own effect.
7. **Integrity:** `HINT` uses authored unfound differences, tension asks Bedrock for a separate beat, and `WAIT` is inert.
8. **Failure:** timeout, cancellation, transport errors, and invalid responses are distinct; none becomes a fake model choice.
9. **Reuse:** pass a new verified context and telemetry object; keep authoritative state changes in the consuming game.
