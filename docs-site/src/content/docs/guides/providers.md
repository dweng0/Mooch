---
title: Providers
description: Configure AI providers for Mooch
---

Mooch supports multiple AI provider types for LLM reasoning, speech-to-text (STT), and text-to-speech (TTS).

## Pre-configured Providers

Select from the dropdown in provider settings:

- **Ollama** — local LLM inference
- **LM Studio** — local LLM inference
- **Custom** — any OpenAI-compatible endpoint

When you select a pre-configured provider and the URL is reachable, available models are fetched automatically. If the provider is unreachable, a warning is displayed.

## Custom Providers

Select **Custom** from the dropdown to manually enter:

- Provider URL
- API key (if required)
- Model name
- STT capability toggle and optional STT model name

Use the **Test** button to verify that reasoning and STT endpoints are reachable.

## STT Providers

Multiple providers can be STT-capable. Set a **preferred STT provider** in settings — it will be used first for transcription, falling back to others if it fails.

Supported STT providers:

- OpenAI-compatible providers with STT capability enabled
- **Qwen** — supports audio transcription via its STT service

## TTS Providers

- **Cosyvoice** — modular TTS provider for synthesizing interviewer speech
- The TTS architecture is pluggable — additional providers can be added without modifying core interview logic
