---
title: Architecture
description: How Mooch is structured
---

Mooch is an Electron app with a multi-process architecture.

## Process Model

- **Main process** — Electron main process handling window management, IPC, and the local bridge API server
- **Renderer process** — The UI, built with web technologies
- **Web Workers** — Audio processing (STT buffering, format detection, VAD) runs in Web Workers to keep the UI responsive

## Key Directories

```
src/
  main/        # Electron main process
  preload/     # Preload scripts for IPC
  renderer/    # UI code
```

## Audio Pipeline

Audio processing is offloaded to Web Workers:

- STT buffering and format conversion run off the main thread
- Workers communicate via `postMessage` with transferable objects
- Worker crashes are detected and recovered from without affecting the app
- Workers are terminated and resources released when sessions end

## Interview Data Model

Each interview session stores:

```
session-dir/
  metadata.json         # Job description, resume, timestamps, completion status
  transcript.md         # Full conversation in markdown
  audio/
    user-turn-N.wav     # Recorded user responses
  feedback/
    turn-N.json         # Per-turn LLM feedback (rating, comment, context)
```

## Conversation Memory

Conversation history is bounded to a rolling window of 30 turns. This keeps memory usage stable even in long interview sessions (60+ minutes).
