---
name: self-assess
description: Analyse the codebase and BDD coverage to find gaps, bugs, and improvement opportunities
tools: [bash, read_file]
---

# Self-Assessment

## Process

1. **Read BDD.md** — know the full spec before assessing anything
2. **Read BDD_STATUS.md** — see which scenarios are covered and which aren't
3. **Read the source code** — does the implementation actually match the scenarios?
4. **Try running the tests** — are they all passing? Any flakes?
5. **Check JOURNAL_INDEX.md** — quick scan of past sessions. Read JOURNAL.md only if you need detail on a specific day.

## What to look for

- Scenarios in BDD.md with no corresponding test (UNCOVERED)
- Tests that exist but are wrong — they pass but don't actually test the scenario
- Code that implements behaviour not described in any scenario (dead code, or missing BDD coverage)
- Build failures, linting errors, type errors
- Edge cases within a scenario that aren't handled

## BDD coverage check

Run this to see the current state:
```bash
python3 scripts/check_bdd_coverage.py BDD.md
```

Any scenario marked `UNCOVERED` is your highest-priority work item.

## Output format

Write findings as a prioritised list:

```
ASSESSMENT Day [N]:
1. [CRITICAL] Scenario "X" is UNCOVERED — no test exists
2. [HIGH] Test for "Y" passes but doesn't actually verify the Then clause
3. [MEDIUM] Code in auth.py has no corresponding BDD scenario
4. [LOW] Lint warning in utils.js
```

Pick the highest-priority item and implement it this session.
