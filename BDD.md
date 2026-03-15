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

    Feature: mock interview

        Scenario: start mock interview with job description
            Given the user has an important interview
            When the user pastes a job description
            Then an option to start a microphone and synthetic voice interview should begin

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

