#!/usr/bin/env python3
"""
Filter issues to only those that are trusted:
  - Authored by the repo owner (with agent-input label), OR
  - Have the agent-approved label AND the repo owner was the one who applied it
    (verified via the issue events API — immune to race conditions)
"""

import argparse
import json
import subprocess
import sys


def get_label_applier(repo, issue_number, label_name):
    """Return the login of whoever last applied label_name to this issue, or None."""
    try:
        result = subprocess.run(
            [
                "gh", "api",
                f"repos/{repo}/issues/{issue_number}/events",
                "--jq",
                f'[.[] | select(.event=="labeled" and .label.name=="{label_name}")] | last | .actor.login',
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        login = result.stdout.strip()
        return login if login and login != "null" else None
    except Exception:
        return None


def verify_issues(issues, repo, owner):
    trusted = []
    for issue in issues:
        author = issue.get("author", {})
        author_login = author.get("login", "") if isinstance(author, dict) else ""
        labels = [l.get("name", "") for l in issue.get("labels", [])]

        if author_login == owner:
            # Owner's own issues are trusted directly
            trusted.append(issue)
        elif "agent-approved" in labels:
            # Community issue: verify the owner was the one who applied the label
            applier = get_label_applier(repo, issue["number"], "agent-approved")
            if applier == owner:
                trusted.append(issue)
            else:
                print(
                    f"  Skipping issue #{issue['number']}: agent-approved label not applied by owner "
                    f"(applied by: {applier or 'unknown'})",
                    file=sys.stderr,
                )

    return trusted


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("issues_file", help="Path to merged issues JSON")
    parser.add_argument("--repo", required=True, help="owner/repo")
    parser.add_argument("--owner", required=True, help="Repo owner login")
    args = parser.parse_args()

    try:
        with open(args.issues_file) as f:
            issues = json.load(f)
        verified = verify_issues(issues, args.repo, args.owner)
        print(json.dumps(verified))
    except (json.JSONDecodeError, FileNotFoundError):
        print("[]")
