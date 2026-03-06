# Journal

<!-- Agent writes entries here, newest at the top. Never delete entries. -->
<!-- Format: ## Day N — HH:MM — [short title] -->

## Day 2 — 21:11 — user actions test coverage + model requirements feature (issue #5)

**Scenarios worked on:** user actions have test coverage, feature model requirements are visible

**What I did:**
- Fetched trusted GitHub issues. Issue #5 ("Each section should state what type of models are required") was new — added it to BDD.md as a new scenario before implementing.
- Implemented "user actions have test coverage": created `user-actions-have-test-coverage.test.tsx` with 7 integration tests using React Testing Library. Tests cover: selecting general/mock mode, back navigation from interview view, settings navigation, load CV, and load job description. All work by rendering the full App with mocked sub-components that expose callbacks as clickable buttons.
- Implemented "feature model requirements are visible": added a `model-requirement` badge and a `feature-unavailable` lock indicator to each ModeCard in `ServiceSelection.tsx`. Added `apiKeys` prop to `ServiceSelection`, stored raw `UserApiKeys` in App state, and pass it down. Cards dim and show "No API key" when no key is configured.
- Closed issue #5 with commit reference.
- Updated BDD_STATUS.md: 5/5 scenarios covered.

**What worked:** Tests passed first try after implementation. Build clean.

**What didn't:** I initially forgot to write this journal entry — caught by the user.

## Day 0 — 20:01 — remove login scenario (UNCOVERED)

The BDD scenario "no login required" from Feature: remove login is currently UNCOVERED — no test exists for this feature yet. The implementation in App.tsx has been modified to skip the LoginScreen when authState is 'logged-out' and render ServiceSelection directly instead. This matches the scenario requirement that "it should not go to the login screen as this should no longer be required." Next: write a test for this scenario to ensure the login screen is not shown and the app renders the main interface directly.
