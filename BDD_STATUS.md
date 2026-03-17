# BDD Status

Checked 27 scenario(s) across 12 test file(s).


## Feature: remove login

- [x] no login required

## Feature: better API key errors

- [x] clear API key error message
- [x] no API key badge only shows when no keys are configured

## Feature: mock interview sessions

- [x] create new interview session with job description and resume
- [x] list and view previous interview sessions
- [x] start real-time voice interview
- [x] degrade gracefully when TTS provider is unavailable
- [x] save interview transcript as markdown
- [x] record and store interview audio per turn
- [x] store real-time LLM feedback as JSON
- [x] playback interview with synchronized feedback
- [x] mark interview as complete or incomplete
- [x] resume incomplete interview session
- [x] graceful failure recovery during interview

## Feature: TTS provider support

- [x] configure Cosyvoice TTS provider
- [x] modular TTS architecture for future providers

## Feature: user journey test coverage

- [x] user actions have test coverage

## Feature: model requirements per feature

- [x] feature model requirements are visible

## Feature: code review chrome extension

- [x] Better context for coding challenges

## Feature: configurable STT provider

- [x] custom provider supports STT
- [x] test custom provider connectivity
- [x] preferred STT provider with fallback
- [x] Qwen API key supports STT transcription

## Feature: pre-configured API providers

- [x] select pre-configured provider from dropdown
- [x] pre-configured provider auto-populates settings
- [x] warn when pre-configured provider is unreachable
- [x] custom provider requires manual entry

---
**27/27 scenarios covered.**
