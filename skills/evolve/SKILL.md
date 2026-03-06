---
name: evolve
description: Build features and fix bugs strictly according to BDD.md scenarios
tools: [bash, read_file, write_file, edit_file]
---

# BDD-Driven Development

## Your Prime Directive

You only build what is in `BDD.md`. Full stop.

Before writing a single line of code, you must be able to point to the Scenario in BDD.md that justifies it. If you can't, you don't build it.

## The Cycle

For each Scenario you work on:

1. **Read the Scenario** — understand the Given/When/Then fully
2. **Write the test first** — name the test after the Scenario, make it fail
3. **Write the minimum code** — only enough to make the test pass
4. **Run all checks** — format, lint, build, test
5. **Commit** — one commit per Scenario

## After each change

1. Run the format command (`$FMT_CMD` from BDD.md config)
2. Run the lint command (`$LINT_CMD`)
3. Run the build command (`$BUILD_CMD`)
4. Run the test command (`$TEST_CMD`)
5. If anything fails: read the error and fix it. Try up to 3 times.
6. If still failing after 3 attempts: `git checkout -- .` (revert to last commit)
7. Commit: `git add -A && git commit -m "Day N (HH:MM): <scenario name>"`
8. Move to the next Scenario

## Naming tests after scenarios

If the Scenario is:
> Scenario: Leave a comment with name field not filled in

Name your test something like:
- `test_leave_a_comment_with_name_field_not_filled_in` (Python/Rust)
- `it('leave a comment with name field not filled in', ...)` (JS/TS)
- `func TestLeaveCommentWithNameNotFilledIn(t *testing.T)` (Go)

This is what `check_bdd_coverage.py` searches for. If you don't name tests after scenarios, coverage will show as 0%.

## What you must never do

- Write code for a feature not in BDD.md
- Skip writing a test before writing code
- Commit code that fails the build or tests
- Delete existing passing tests
- Modify IDENTITY.md, scripts/evolve.sh, or .github/workflows/

## When an issue proposes a new feature

1. Decide if it's a good addition
2. If yes: add the Scenario to BDD.md first
3. Commit the BDD.md change: `git add BDD.md && git commit -m "Day N: add scenario: [name]"`
4. Then implement it (test first)

## Filing issues for yourself

If you find a problem you can't fix this session:
```bash
gh issue create --repo OWNER/REPO \
    --title "..." --body "..." --label "agent-self"
```

If you need human input:
```bash
gh issue create --repo OWNER/REPO \
    --title "..." --body "..." --label "agent-help-wanted"
```
