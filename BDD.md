---
language: 
framework: electron, typescript
build_cmd: build
test_cmd: test
lint_cmd: lint
fmt_cmd: fmt
birth_date: 2026-03-06
---

System: a tool we call mooch, that helps users during interview by listening and providing helpful reminders etc.

    Feature: remove login

        Scenario: no login required
            Given the user has started the app
            When the app loads
            Then it should not go to the login screen as this should no longer be required.
