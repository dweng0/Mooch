# Context: claude-code-harness branch

Goal: run Mooch (the Electron interview copilot) on a long-lived Claude Code token
instead of an Anthropic API key, with local STT/TTS. Not merged to `main` on purpose.

## Claude reasoning
- `src/main/services/claude-cli.ts` runs `claude -p` authenticated by `CLAUDE_CODE_OAUTH_TOKEN`
  (from `claude setup-token`). No tools for Q&A; `Read` only for screenshot analysis.
- `claude.ts` falls back to the CLI when no Anthropic API key is stored. `ai-provider.ts`
  lists `claude` as available when the token is set.
- `src/main/index.ts` loads `.env` via `dotenv/config`. Token lives in `.env` (gitignored);
  `.env.example` has a blank placeholder. `claude` must be on PATH for the Electron process.

## Local STT/TTS
- `docker/speech/docker-compose.yml`: speaches (CPU), OpenAI-compatible, `127.0.0.1:8000`.
  Start: `docker compose -f docker/speech/docker-compose.yml up -d`.
- Models (download once via `POST /v1/models/<id>`): `Systran/faster-whisper-small.en`,
  `speaches-ai/Kokoro-82M-v1.0-ONNX`. Verified round trip TTS -> STT (~5s each on CPU).
- Settings values: STT URL `http://localhost:8000/v1`, TTS URL `http://localhost:8000`
  (STT needs `/v1`, TTS must not have it). Voice lookup 404s; falls back to `alloy`, which works.
- thinkpad also runs wyoming whisper/piper (10300/10200), but that is a different protocol
  and is not used.

## Status / next
- Verified: CLI path returns output with the token; STT/TTS container works.
- NOT yet verified: full loop inside the running app (mic -> STT -> Claude -> TTS).
- Pre-existing tsc error at `src/main/index.ts` (~533, ArrayBuffer type), unrelated.
- No BDD scenarios/tests added for this yet (skipped on request).
- `test_tts.py` has a hardcoded (dead) DashScope key committed; remove or rotate.
