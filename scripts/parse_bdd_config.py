#!/usr/bin/env python3
"""
Parse YAML frontmatter from BDD.md and output shell variable assignments.

Usage:
    eval "$(python3 scripts/parse_bdd_config.py BDD.md)"

Outputs variables:
    LANGUAGE, FRAMEWORK, BUILD_CMD, TEST_CMD, LINT_CMD, FMT_CMD, BIRTH_DATE
"""

import sys
import re

DEFAULTS = {
    "language": "unknown",
    "framework": "none",
    "build_cmd": "echo 'No build_cmd set in BDD.md'",
    "test_cmd": "echo 'No test_cmd set in BDD.md'",
    "lint_cmd": "echo 'No lint_cmd set in BDD.md'",
    "fmt_cmd": "echo 'No fmt_cmd set in BDD.md'",
    "birth_date": "2026-01-01",
}

def parse_frontmatter(path):
    try:
        with open(path) as f:
            content = f.read()
    except FileNotFoundError:
        print(f"ERROR: {path} not found", file=sys.stderr)
        sys.exit(1)

    if not content.startswith("---"):
        return {}

    end = content.find("\n---", 3)
    if end == -1:
        return {}

    frontmatter = content[3:end].strip()
    result = {}

    for line in frontmatter.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            k = key.strip().lower()
            v = value.strip().strip('"').strip("'")
            if k == "language":
                v = v.lower()
            result[k] = v

    return result

def shell_escape(value):
    return "'" + value.replace("'", "'\\''") + "'"

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "BDD.md"
    config = parse_frontmatter(path)

    for key, default in DEFAULTS.items():
        value = config.get(key, default)
        shell_key = key.upper().replace("-", "_")
        print(f"export {shell_key}={shell_escape(value)}")

if __name__ == "__main__":
    main()
