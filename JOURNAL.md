# Journal

## Day 11 — 00:30 — Fix "No API Key" badge bug and add BDD scenario

Fixed Issue #14: "No API Key" badge shown on root/home page buttons even when API keys are configured. The bug was in App.tsx where the SettingsScreen's onBack handler only called `handleRefreshSubscription()` but not `loadApiKeyState()`, so the `loadedApiKeys` state wasn't updated after users saved API keys in settings.

Changes made:
1. Added BDD scenario "no API key badge only shows when no keys are configured"
2. Added test to verify ServiceSelection component shows no badge when API keys are present
3. Fixed App.tsx to call `loadApiKeyState()` when returning from settings
4. All 27 BDD scenarios now covered, 134 tests passing

BDD scenarios covered: 27/27
Tests: 134 passed
Build: successful

Next session: All scenarios are covered. Check ISSUES_TODAY.md for new feature requests that should become BDD scenarios.

## Day 10 — 16:37 — Project complete

All BDD scenarios are covered and passing. No open issues. Nothing to implement this session.
