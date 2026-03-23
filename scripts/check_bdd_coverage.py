#!/usr/bin/env python3
"""
Check that every Scenario in BDD.md has a corresponding test.

Usage:
    python3 scripts/check_bdd_coverage.py BDD.md > BDD_STATUS.md

Exit code:
    0 — all scenarios covered
    1 — one or more scenarios uncovered

How coverage is determined:
    The scenario name is normalized to snake_case and searched across all test
    files in the project. The agent is expected to name tests after scenarios.

    e.g. "Scenario: Leave a comment with name field not filled in"
         → searches for "leave_a_comment_with_name_field_not_filled_in"
           or "leave a comment with name field" (partial match, case-insensitive)
"""

import sys
import os
import re
import glob

# Test file patterns to search (extend as needed)
TEST_FILE_PATTERNS = [
    "**/*test*.py",
    "**/*_test.py",
    "**/test_*.py",
    "**/*.test.js",
    "**/*.spec.js",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/*.test.jsx",
    "**/*.spec.jsx",
    "**/*.test.tsx",
    "**/*.spec.tsx",
    "**/src/**/*.rs",       # Rust inline tests
    "**/*_test.go",
    "**/test/**/*.java",
    "**/*Test.java",
    "**/tests/**/*.py",
    "**/test/**/*.py",
    "**/tests/**/*.ts",
    "**/tests/**/*.js",
]

EXCLUDE_DIRS = {".git", "node_modules", "target", "dist", "build", ".venv", "__pycache__"}


def normalize(text):
    """Convert scenario name to searchable form."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", "_", text.strip())
    return text


def normalize_partial(text):
    """First 6 words of scenario name for partial matching."""
    words = text.lower().split()[:6]
    return " ".join(re.sub(r"[^a-z0-9]", "", w) for w in words if w)


def parse_scenarios(bdd_path):
    """Extract (feature_name, scenario_name) pairs from BDD.md."""
    scenarios = []
    current_feature = None

    with open(bdd_path) as f:
        in_frontmatter = False
        lines = f.readlines()

    # Skip frontmatter
    start = 0
    if lines and lines[0].strip() == "---":
        in_frontmatter = True
        for i, line in enumerate(lines[1:], 1):
            if line.strip() == "---":
                start = i + 1
                break

    for line in lines[start:]:
        stripped = line.strip()
        feature_match = re.match(r"Feature:\s*(.+)", stripped, re.IGNORECASE)
        scenario_match = re.match(r"Scenario(?:\s+Outline)?:\s*(.+)", stripped, re.IGNORECASE)

        if feature_match:
            current_feature = feature_match.group(1).strip()
        elif scenario_match:
            scenario_name = scenario_match.group(1).strip()
            scenarios.append((current_feature or "Unknown Feature", scenario_name))

    return scenarios


def find_test_files():
    """Find all test files in the project."""
    test_files = set()
    for pattern in TEST_FILE_PATTERNS:
        for path in glob.glob(pattern, recursive=True):
            # Exclude known non-source dirs
            parts = path.split(os.sep)
            if any(part in EXCLUDE_DIRS for part in parts):
                continue
            if os.path.isfile(path):
                test_files.add(path)
    return sorted(test_files)


def check_coverage(scenario_name, test_files, test_contents):
    """Return True if any test file references this scenario."""
    full = normalize(scenario_name)
    partial = normalize_partial(scenario_name)

    for path, content in test_contents.items():
        content_lower = content.lower()
        # Try full snake_case match
        if full in content_lower:
            return True
        # Try partial match (first 6 words)
        if partial and partial in content_lower:
            return True
        # Try each word of the scenario (all significant words present)
        words = [w for w in re.sub(r"[^a-z0-9\s]", "", scenario_name.lower()).split() if len(w) > 3]
        if len(words) >= 3 and all(w in content_lower for w in words[:4]):
            return True

    return False


def main():
    bdd_path = sys.argv[1] if len(sys.argv) > 1 else "BDD.md"

    if not os.path.exists(bdd_path):
        print(f"# BDD Status\n\nERROR: {bdd_path} not found.")
        sys.exit(1)

    scenarios = parse_scenarios(bdd_path)
    if not scenarios:
        print("# BDD Status\n\nNo scenarios found in BDD.md.")
        sys.exit(0)

    test_files = find_test_files()
    test_contents = {}
    for path in test_files:
        try:
            with open(path) as f:
                test_contents[path] = f.read()
        except Exception:
            pass

    covered = []
    uncovered = []
    current_feature = None

    lines = ["# BDD Status\n", f"Checked {len(scenarios)} scenario(s) across {len(test_files)} test file(s).\n"]

    for feature, scenario in scenarios:
        if feature != current_feature:
            current_feature = feature
            lines.append(f"\n## Feature: {feature}\n")

        is_covered = check_coverage(scenario, test_files, test_contents)
        if is_covered:
            covered.append(scenario)
            lines.append(f"- [x] {scenario}")
        else:
            uncovered.append(scenario)
            lines.append(f"- [ ] UNCOVERED: {scenario}")

    lines.append(f"\n---\n**{len(covered)}/{len(scenarios)} scenarios covered.**")
    if uncovered:
        lines.append(f"\n{len(uncovered)} scenario(s) need tests:")
        for s in uncovered:
            lines.append(f"- {s}")

    print("\n".join(lines))

    if uncovered:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
