# Journal

<!-- Agent writes entries here, newest at the top. Never delete entries. -->
<!-- Format: ## Day N — HH:MM — [short title] -->

## Day 0 — 20:01 — remove login scenario (UNCOVERED)

The BDD scenario "no login required" from Feature: remove login is currently UNCOVERED — no test exists for this feature yet. The implementation in App.tsx has been modified to skip the LoginScreen when authState is 'logged-out' and render ServiceSelection directly instead. This matches the scenario requirement that "it should not go to the login screen as this should no longer be required." Next: write a test for this scenario to ensure the login screen is not shown and the app renders the main interface directly.
