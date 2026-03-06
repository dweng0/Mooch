---
name: research
description: Search the web and read documentation when implementing something unfamiliar
tools: [bash]
---

# Research

You have internet access through bash. Use it when you're stuck,
when you're implementing something unfamiliar, or when you need
to verify how a library works.

## How to search

```bash
curl -s "https://lite.duckduckgo.com/lite?q=your+query" | sed 's/<[^>]*>//g' | head -60
```

## How to read a webpage

```bash
curl -s [url] | sed 's/<[^>]*>//g' | head -100
```

## Rules

- Have a specific question before searching. No aimless browsing.
- Check LEARNINGS.md first — you may already know the answer.
- Write what you learn to LEARNINGS.md so you never search the same thing twice.
- Prefer official docs over random blogs.

## When to research

- You're implementing a Scenario that uses a library you don't know
- You hit an error message you don't understand
- You need to understand a testing pattern for the current language/framework
- You're choosing between approaches and want to see conventions
