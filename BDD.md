---
language: typescript
framework: electron, typescript
build_cmd: npm run build
test_cmd: npm test
birth_date: 2026-03-06
---

System: a tool we call mooch, that helps users during interview by listening and providing helpful reminders etc.

    Feature: remove login

        Scenario: no login required
            Given the user has started the app
            When the app loads
            Then it should not go to the login screen as this should no longer be required.

    Feature: better API key errors

        Scenario: clear API key error message
            Given the user has an API key configured
            When the API key returns an error
            Then the error message should clearly indicate whether it is a token limit issue or another problem

        Scenario: no API key badge only shows when no keys are configured
            Given the user has configured API keys in settings
            When the user navigates back to the service selection screen
            Then the "No API key" badge should not appear on any mode cards

    Feature: mock interview sessions

        Scenario: create new interview session with job description and resume
            Given the user is on the mock interview page
            When the user pastes a job description and uploads or pastes their resume
            Then the app should save the session with a timestamp and display a "Start Interview" button

        Scenario: list and view previous interview sessions
            Given the user is on the mock interview page
            When the app loads
            Then it should display a list of all saved interview sessions with job title, date, and completion status (complete/incomplete)

        Scenario: start real-time voice interview
            Given the user has created an interview session with job description and resume
            When the user clicks "Start Interview"
            Then the app should verify required models are available (STT, LLM, TTS) and begin real-time voice interaction

        Scenario: degrade gracefully when TTS provider is unavailable
            Given the user has started an interview session
            When the configured TTS provider fails or is unavailable
            Then the app should warn the user and continue with text-only mode, storing the conversation

        Scenario: save interview transcript as markdown
            Given the user is in or has completed an interview session
            When the interview is in progress or has ended
            Then the app should maintain and save a markdown file containing the full conversation (user turns, LLM questions, timestamps) in the session directory

        Scenario: record and store interview audio per turn
            Given the user is in a real-time voice interview
            When the user completes a response to an interview question
            Then the app should save the audio file as user-turn-N.wav in the session's audio/ directory

        Scenario: store real-time LLM feedback as JSON
            Given the user has answered an interview question and the audio is saved
            When the LLM generates feedback on the response
            Then the app should save feedback as turn-N.json in the session's feedback/ directory, containing: rating, comment, context (job requirement matched, resume skill used, conversation flow notes)

        Scenario: playback interview with synchronized feedback
            Given the user is reviewing a completed interview session
            When the user clicks "Review"
            Then the app should load the session's metadata and feedback JSON files, play audio files in sequence, and display corresponding feedback alongside playback as each audio file plays

        Scenario: review interview with same stats and controls as live interview
            Given the user is reviewing a completed interview session
            When the user views the review page
            Then the review page should display with the same layout as the live interview, showing feedback icons (rating indicator, thinking icon, context icons) below each message and audio playback buttons for both user responses and interviewer questions

        Scenario: mark interview as complete or incomplete
            Given an interview session is in progress or has ended
            When the LLM determines the interview is complete (or the user ends it)
            Then the app should set a "complete" flag on the session so users can distinguish finished vs. unfinished interviews in the list

        Scenario: resume incomplete interview session
            Given the user has an incomplete interview session
            When the user clicks "Resume" on that session
            Then the app should load the previous conversation context and continue the interview from where it left off

        Scenario: graceful failure recovery during interview
            Given an interview is in progress
            When a provider fails (STT, LLM, or TTS timeout/error)
            Then the app should save all progress collected so far (transcript, audio, feedback) and display an error message allowing the user to resume later

        Scenario: delete all interview sessions
            Given the user is on the mock interview sessions page
            When the user clicks "Delete All Sessions"
            Then the app should display a confirmation dialog
            And when the user confirms the deletion
            Then all interview sessions should be deleted and the sessions list should be empty

    Feature: TTS provider support

        Scenario: configure Cosyvoice TTS provider
            Given the user is in provider settings
            When the user selects or configures Cosyvoice as the TTS provider
            Then the app should be able to use Cosyvoice to synthesize speech for interview responses

        Scenario: modular TTS architecture for future providers
            Given the TTS system is implemented with Cosyvoice
            When a new TTS provider needs to be added
            Then the architecture should allow plugging in additional TTS providers (e.g., OpenAI TTS, ElevenLabs) without modifying core interview logic

    Feature: user journey test coverage

        Scenario: user actions have test coverage
            Given the app is running
            When the user performs any supported action
            Then that action should have an automated test covering it

    Feature: model requirements per feature

        Scenario: feature model requirements are visible
            Given the user is looking at the app
            When a feature requires a specific type of API key or model
            Then the feature section should clearly indicate which model type is required

    Feature: code review chrome extension

        Scenario: Better context for coding challenges
            Given A user is  doing a technical interview, coding on a website
            When When the site opens and they are on the page with the code
            Then Then the llm should be able to identify the code, and provide hints and tips

    Feature: local API for chrome extension integration

        Contract: Mooch Local Bridge API
            Base URL: http://localhost:62544
            All requests and responses use Content-Type: application/json
            All requests must include header X-Mooch-Client: chrome-extension
            Server must bind to 127.0.0.1 only (not 0.0.0.0)
            CORS: Allow origin chrome-extension://*

            GET /health
                Response 200: { "status": "ok", "version": "string", "activeSession": "string | null" }

            GET /api/providers
                Response 200: { "providers": [{ "name": "string", "type": "anthropic | openai-compatible", "configured": true }] }
                Note: must never expose API keys or secrets

            POST /api/hint
                Request:  { "code": "string", "pageTitle": "string", "language": "string | null", "metadata": { "difficulty": "string | null", "tags": ["string"] | null, "constraints": "string | null" } | null, "hintStyle": "gentle | detailed | pseudocode" | null }
                Response 200: { "hint": "string" }
                Response 503: { "error": "no provider configured" }
                Note: if an interview session is active, the server should automatically append job description and resume to the LLM context

            POST /api/analyze
                Request:  { "code": "string", "context": "string | null" }
                Response 200: { "analysis": "string" }
                Response 503: { "error": "no provider configured" }

        Scenario: expose local HTTP API for extension communication
            Given the Mooch desktop app is running
            When the app starts
            Then it should start a local HTTP server bound to 127.0.0.1 on port 62544
            And expose a GET /health endpoint that returns { status, version, activeSession }

        Scenario: accept hint requests from chrome extension
            Given the local API server is running
            When a POST request is received at /api/hint with the contract-defined request body
            Then the app should route the request through its configured LLM provider
            And return { hint: "string" } on success or { error: "string" } on failure

        Scenario: expose provider configuration via API
            Given the local API server is running
            When a GET request is received at /api/providers
            Then the app should return the list of configured providers with name, type, and configured status
            And must never include API keys or secrets in the response

        Scenario: accept code analysis requests from chrome extension
            Given the local API server is running
            When a POST request is received at /api/analyze with code text and optional context
            Then the app should analyze the code using its configured providers
            And return { analysis: "string" } on success

        Scenario: include active interview context in hint requests
            Given the local API server is running and an interview session is active
            When a POST /api/hint request is received from the chrome extension
            Then the app should automatically append the active session's job description and resume to the LLM context
            And the activeSession field in GET /health should reflect the session ID

        Scenario: restrict local API to localhost only
            Given the local API server is running
            When a request arrives from a non-localhost origin or without the X-Mooch-Client header
            Then the request should be rejected with 403 to prevent external access to the user's data

    Feature: configurable STT provider

        Scenario: custom provider supports STT
            Given the user has configured a custom OpenAI-compatible provider
            When the user enables the STT capability and optionally sets a STT model name
            Then the custom provider should be usable for audio transcription

        Scenario: test custom provider connectivity
            Given the user has entered a custom provider URL and settings in the form
            When the user clicks the Test button
            Then the app should report whether the reasoning and STT endpoints are reachable

        Scenario: preferred STT provider with fallback
            Given the user has multiple STT-capable providers configured
            When the user selects a preferred STT provider in settings
            Then that provider should be used first for transcription and fall back to others if it fails

        Scenario: Qwen API key supports STT transcription
            Given the user has configured a Qwen API key
            When the user performs audio transcription
            Then the app should be able to transcribe audio using the Qwen STT service

    Feature: pre-configured API providers

        Scenario: select pre-configured provider from dropdown
            Given the user is in the provider settings
            When the user clicks the provider dropdown
            Then they should see a list of pre-configured providers (Ollama, LM Studio, etc.) plus a "Custom" option

        Scenario: pre-configured provider auto-populates settings
            Given the user has selected a pre-configured provider from the dropdown
            When the provider URL is reachable
            Then the URL field should be pre-filled and available models should be fetched and displayed in a dropdown

        Scenario: warn when pre-configured provider is unreachable
            Given the user has selected a pre-configured provider
            When the provider URL cannot be reached
            Then the app should display a warning that the provider is unreachable

        Scenario: custom provider requires manual entry
            Given the user is in the provider settings
            When the user selects "Custom" from the provider dropdown
            Then they should be able to manually enter the provider URL as before

    Feature: conversation history memory limits

        Scenario: conversation history bounded to rolling window
            Given the user is in a long interview session
            When the conversation history exceeds 30 turns
            Then the app should truncate older turns keeping only the most recent 30 entries so memory usage remains bounded

        Scenario: memory usage stable over long interview sessions
            Given the user has been in an interview for more than 60 minutes
            When many conversation turns have accumulated
            Then memory consumption should remain stable and not grow unboundedly

    Feature: web workers for audio processing

        Scenario: STT processing runs in a web worker
            Given the app is processing audio input
            When speech-to-text transcription is performed
            Then the processing should run in a web worker so the UI thread remains responsive

        Scenario: audio processing does not block the UI
            Given the app is handling real-time audio
            When STT, TTS buffering, or format conversion is occurring
            Then the main UI thread should not be blocked and the interface should remain interactive

    Feature: audio pipeline integration tests

        Scenario: end-to-end audio pipeline integration test
            Given the app's audio pipeline components (STT, LLM, TTS)
            When tested end-to-end with mock providers
            Then the integration test suite should verify the complete flow from audio input through LLM processing to TTS output

