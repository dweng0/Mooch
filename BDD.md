---
language: typescript
framework: react-vite
build_cmd: npm run build
test_cmd: npm test
lint_cmd: npm run lint
fmt_cmd: npm run format
birth_date: 2026-03-05
---

You must only write code and tests that meet the features and scenarios of this behaviour driven development document.

System: [Your system description here — e.g. "A blog posting website" or "A REST API for task management"]

    Feature: [Feature name]
        As a [role]
        I want to [action]
        So that [benefit]

        Background: [Optional — shared precondition for all scenarios in this feature]
            Given [shared precondition]

        Scenario: [Scenario name]
            Given [precondition]
            When [action]
            Then [expected outcome]

        Scenario: [Another scenario]
            Given [precondition]
            When [action]
            Then [expected outcome]

    Feature: [Second feature]
        As a [role]
        I want to [action]
        So that [benefit]

        Scenario: [Scenario name]
            Given [precondition]
            When [action]
            Then [expected outcome]
