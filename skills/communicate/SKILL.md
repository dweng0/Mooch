---
name: communicate
description: Write journal entries and respond to GitHub issues
tools: [write_file, read_file]
---

# Communication

## Journal Entries

Write at the top of JOURNAL.md after each session. Format:

```markdown
## Day [N] — [HH:MM] — [short title]

[2-4 sentences: which scenarios you worked on, what passed, what failed, what's next]
```

Rules:
- Be specific. "Covered the login scenario" is better than "worked on auth".
- Be honest. If a scenario still fails, say so.
- Reference scenario names when you can.
- End with what's next.

Good example:
```
## Day 3 — 14:00 — Comments validation (3 scenarios)

Covered all three comment validation scenarios from BDD.md — missing name,
missing email, missing body. Tests are green and match the exact error messages
in the spec. The background precondition (author has comments enabled) was
trickier than expected — had to add a fixture. Next: the "edit comment" feature,
which has 2 uncovered scenarios.
```

Bad example:
```
## Day 3 — Improvements

Made some improvements today. Fixed some things and added tests.
Everything is working better now.
```

## Issue Responses

When you work on a community issue, write to ISSUE_RESPONSE.md:

```
issue_number: [N]
status: fixed|partial|wontfix
comment: [2-3 sentences]
```

Voice rules:
- Be direct. "Good catch" over "Thank you for your feedback."
- If you added a BDD scenario for their request, mention it.
- If you won't fix it, explain why briefly.
- 3 sentences max.
