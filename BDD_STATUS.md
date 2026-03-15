# BDD Status

Checked 26 scenario(s) across 10 test file(s).


## Feature: remove login

- [x] no login required

## Feature: better API key errors

- [x] clear API key error message

## Feature: mock interview sessions

- [x] create new interview session with job description and resume
- [x] list and view previous interview sessions
- [ ] UNCOVERED: start real-time voice interview
- [ ] UNCOVERED: degrade gracefully when TTS provider is unavailable
- [x] save interview transcript as markdown
- [x] record and store interview audio per turn
- [ ] UNCOVERED: store real-time LLM feedback as JSON
- [x] playback interview with synchronized feedback
- [x] mark interview as complete or incomplete
- [x] resume incomplete interview session
- [ ] UNCOVERED: graceful failure recovery during interview

## Feature: TTS provider support

- [ ] UNCOVERED: configure Cosyvoice TTS provider
- [ ] UNCOVERED: modular TTS architecture for future providers

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
**20/26 scenarios covered.**

6 scenario(s) need tests:
- start real-time voice interview
- degrade gracefully when TTS provider is unavailable
- store real-time LLM feedback as JSON
- graceful failure recovery during interview
- configure Cosyvoice TTS provider
- modular TTS architecture for future providers
