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
