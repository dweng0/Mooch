---
title: BAADD Framework
description: How Mooch is developed using Behaviour and AI Driven Development
---

Mooch is built using **BAADD** (Behaviour and AI Driven Development) — a framework where an AI agent builds and maintains the project driven entirely by BDD specifications.

## How It Works

1. All features are specified as Gherkin-style scenarios in `BDD.md`
2. An AI agent reads the spec and implements scenarios test-first
3. Every change must pass the build and test suite
4. Progress is tracked in `BDD_STATUS.md`
5. The agent keeps a journal of each session in `JOURNAL.md`

## Key Files

| File | Purpose |
|------|---------|
| `BDD.md` | The spec — all features and scenarios live here |
| `BDD_STATUS.md` | Current coverage status of all scenarios |
| `IDENTITY.md` | Agent constitution and rules |
| `JOURNAL.md` | Session logs |
| `JOURNAL_INDEX.md` | One-line-per-session index |
| `LEARNINGS.md` | Agent's external memory for research findings |

## The Evolution Loop

The agent runs on a schedule via GitHub Actions (`scripts/evolve.sh`):

1. Read the spec and current status
2. Check for open GitHub issues that propose new features
3. Pick the highest-priority uncovered scenario
4. Write the test first, confirm it fails
5. Write the minimum code to make it pass
6. Run build and tests
7. Commit and update status

## Running Locally

```bash
# Check BDD coverage
python3 scripts/check_bdd_coverage.py BDD.md

# Run the evolution loop (requires Anthropic API key)
ANTHROPIC_API_KEY=sk-... ./scripts/evolve.sh
```

## Adding Features

To add a feature to Mooch:

1. Open a GitHub issue describing the feature
2. The repo owner labels it `agent-input` (or `agent-approved` for community issues)
3. The agent picks it up, adds scenarios to `BDD.md`, and implements them
