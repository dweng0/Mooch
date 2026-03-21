---
title: Introduction
description: What is Mooch and what can it do?
---

Mooch is an AI-powered interview assistant built as an Electron desktop app. It helps you prepare for and navigate technical interviews with real-time AI support.

## What Mooch Does

- **Mock Interviews** — Paste a job description and your resume, then practice with an AI interviewer that asks relevant questions via real-time voice conversation. Get per-turn feedback on your responses.
- **Code Interview Mode** — When doing live coding challenges, a companion Chrome extension sends your code to Mooch, which provides hints and analysis in real time.
- **Multi-Provider** — Bring your own API keys. Mooch supports Anthropic, OpenAI-compatible providers, Ollama, LM Studio, Cosyvoice (TTS), Qwen, and more.

## How It's Built

Mooch is developed using **Poppins** (Behaviour and AI Driven Development). Every feature is specified as a BDD scenario in `BDD.md`, and an AI agent implements them test-first. This means every feature has test coverage by design.

## Tech Stack

- **Electron** + **TypeScript** — desktop app
- **Vite** — build tooling via electron-vite
- **Vitest** — testing
- **Web Workers** — audio processing runs off the main thread
- **Local HTTP Bridge** — Chrome extension communicates via `localhost:62544`
