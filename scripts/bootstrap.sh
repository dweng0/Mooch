#!/bin/bash
# scripts/bootstrap.sh — One-time project scaffolding.
# Runs automatically on Day 0 when no project exists yet.
# After this completes, evolve.sh takes over for all future sessions.
#
# Usage:
#   ANTHROPIC_API_KEY=sk-... ./scripts/bootstrap.sh

set -euo pipefail

# ── Load .env if present ──
if [ -f .env ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

# ── Load config from BDD.md ──
echo "→ Loading config from BDD.md..."
eval "$(python3 scripts/parse_bdd_config.py BDD.md)"
echo "  Language:  $LANGUAGE"
echo "  Framework: $FRAMEWORK"
echo "  Build:     $BUILD_CMD"
echo "  Test:      $TEST_CMD"
echo ""

REPO="${REPO:-$(git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]//' | sed 's/\.git$//' || echo 'unknown/repo')}"
MODEL="${MODEL:-claude-haiku-4-5-20251001}"
DATE=$(date +%Y-%m-%d)
SESSION_TIME=$(date +%H:%M)

echo "=== BAADD Bootstrap ($DATE $SESSION_TIME) ==="
echo "Repo:  $REPO"
echo "Model: $MODEL"
echo ""

# ── Setup environment ──
bash scripts/setup_env.sh
echo ""

TIMEOUT_CMD="timeout"
if ! command -v timeout &>/dev/null; then
    command -v gtimeout &>/dev/null && TIMEOUT_CMD="gtimeout" || TIMEOUT_CMD=""
fi

# ── Ensure journal files exist before agent runs ──
if [ ! -f JOURNAL.md ]; then
    echo "→ Creating JOURNAL.md..."
    printf "# Journal\n" > JOURNAL.md
fi
if [ ! -f JOURNAL_INDEX.md ]; then
    echo "→ Creating JOURNAL_INDEX.md..."
    printf "# Journal Index\n\n| Day | Date | Time | Coverage | Summary |\n|-----|------|------|----------|---------|\n" > JOURNAL_INDEX.md
fi

# ── Run bootstrap agent session ──
echo "→ Starting bootstrap session..."
echo ""

PROMPT_FILE=$(mktemp)
cat > "$PROMPT_FILE" <<PROMPT
You are bootstrapping a brand new project. Today is $DATE $SESSION_TIME.

Read these files first:
1. IDENTITY.md — your rules and purpose
2. BDD.md — the full spec for this project

=== YOUR TASK ===

The project does not exist yet. Your job is to scaffold it from scratch so that:
1. The project compiles/runs
2. The test suite runs (even with zero tests passing)
3. The CI workflow works

You must NOT implement any BDD scenarios yet. This is setup only.
Scenarios get implemented in future sessions by evolve.sh.

=== WHAT TO BUILD ===

Language:  $LANGUAGE
Framework: $FRAMEWORK
Build cmd: $BUILD_CMD
Test cmd:  $TEST_CMD
Lint cmd:  $LINT_CMD
Format cmd: $FMT_CMD

=== PHASE 1: Scaffold the project ===

Create the initial project structure appropriate for $LANGUAGE / $FRAMEWORK.

Common scaffold commands (use what fits, adapt as needed):

TypeScript + React Vite:
    npm create vite@latest . -- --template react-ts
    npm install

TypeScript + Express:
    npm init -y
    npm install express
    npm install -D typescript @types/node @types/express ts-node nodemon jest ts-jest @types/jest
    npx tsc --init

Node (plain):
    npm init -y
    npm install -D jest

Python:
    python3 -m venv .venv
    source .venv/bin/activate
    pip install pytest
    mkdir -p src tests
    touch src/__init__.py tests/__init__.py

Rust:
    cargo init

Go:
    go mod init \$(basename \$(pwd))

Java (Maven):
    mvn archetype:generate -DgroupId=com.example -DartifactId=app -DarchetypeArtifactId=maven-archetype-quickstart -DinteractiveMode=false

If the framework is something specific (e.g. Django, Next.js, NestJS), use its
standard scaffold tool. Research with curl if unsure:
    curl -s "https://lite.duckduckgo.com/lite?q=$FRAMEWORK+getting+started+scaffold" | sed 's/<[^>]*>//g' | head -40

=== PHASE 2: Configure build and test commands ===

Make sure these commands work:
- $BUILD_CMD
- $TEST_CMD
- $LINT_CMD (set up linting config if needed)
- $FMT_CMD (set up formatter config if needed)

If the scaffold already provides these, verify they run without error.
If not, install and configure the appropriate tools.

Write a placeholder test so the test runner has something to execute:
- Name it "placeholder" or "setup" — it just needs to pass
- This confirms the test infrastructure works
- Future sessions will replace this with real BDD scenario tests

=== PHASE 3: Create CI workflow ===

Create .github/workflows/ci.yml that:
- Triggers on push and pull_request to main
- Sets up the correct language/runtime
- Runs: $BUILD_CMD
- Runs: $TEST_CMD
- Runs: $LINT_CMD (optional, non-blocking is fine)

Tailor it to $LANGUAGE. Examples:

For TypeScript/Node:
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm install
    - run: $BUILD_CMD
    - run: $TEST_CMD

For Python:
    - uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    - run: pip install -r requirements.txt
    - run: $TEST_CMD

For Rust:
    - uses: dtolnay/rust-toolchain@stable
    - run: $BUILD_CMD
    - run: $TEST_CMD

For Go:
    - uses: actions/setup-go@v5
    - run: $BUILD_CMD
    - run: $TEST_CMD

=== PHASE 4: Verify everything works ===

Run these and confirm they succeed:
    $BUILD_CMD
    $TEST_CMD

If anything fails, fix it before moving on. Keep trying until both pass.

=== PHASE 5: Commit ===

Once build and tests pass:
    git add -A
    git commit -m "Bootstrap: scaffold $LANGUAGE/$FRAMEWORK project"

Then mark bootstrap as complete:
    touch .baadd_initialized
    git add .baadd_initialized
    git commit -m "Bootstrap: mark project as initialized"

=== PHASE 6: Journal ===

Write a journal entry at the TOP of JOURNAL.md:
## Day 0 — $SESSION_TIME — Bootstrap

[2-4 sentences: what you scaffolded, what commands work, what the first evolution session should tackle]

Commit: git add JOURNAL.md && git commit -m "Bootstrap: journal entry"

=== REMINDER ===

You have internet access via bash (curl). Use it if you need to look up
scaffold commands or config syntax for $LANGUAGE/$FRAMEWORK.
Check LEARNINGS.md first — it may already have relevant notes.
Write new findings to LEARNINGS.md.

Now begin. Read IDENTITY.md first, then BDD.md.
PROMPT

AGENT_LOG=$(mktemp)
${TIMEOUT_CMD:+$TIMEOUT_CMD 3600} python3 scripts/agent.py \
    --model "$MODEL" \
    --mode bootstrap \
    --skills ./skills \
    < "$PROMPT_FILE" 2>&1 | tee "$AGENT_LOG" || true

rm -f "$PROMPT_FILE"

if grep -q '"type":"error"' "$AGENT_LOG" 2>/dev/null; then
    echo "  API error detected. Exiting for retry."
    rm -f "$AGENT_LOG"
    exit 1
fi
rm -f "$AGENT_LOG"

echo ""
echo "→ Bootstrap session complete. Verifying..."

# ── Verify build and tests pass ──
BUILD_OK=false
TEST_OK=false

eval "$BUILD_CMD" > /dev/null 2>&1 && BUILD_OK=true || true
eval "$TEST_CMD"  > /dev/null 2>&1 && TEST_OK=true  || true

echo "  Build: $($BUILD_OK && echo PASS || echo FAIL)"
echo "  Tests: $($TEST_OK  && echo PASS || echo FAIL)"

if [ "$BUILD_OK" = false ] || [ "$TEST_OK" = false ]; then
    echo ""
    echo "  Bootstrap incomplete — build or tests still failing."
    echo "  Run ./scripts/bootstrap.sh again to retry, or fix manually."
    exit 1
fi

# ── Ensure journal has a Day 0 entry ──
if ! grep -q "## Day 0" JOURNAL.md 2>/dev/null; then
    echo "→ Agent did not write journal entry — writing fallback..."
    JOURNAL_ENTRY="## Day 0 — $SESSION_TIME — Bootstrap

Bootstrapped $LANGUAGE/$FRAMEWORK project. Build: $BUILD_CMD. Test: $TEST_CMD.
(Entry written by bootstrap.sh fallback — agent did not complete Phase 6.)
"
    # Prepend after the first line (the # Journal heading)
    awk -v entry="$JOURNAL_ENTRY" 'NR==1{print; print ""; print entry; next}1' JOURNAL.md > JOURNAL.md.tmp && mv JOURNAL.md.tmp JOURNAL.md
    git add JOURNAL.md
    git commit -m "Bootstrap: fallback journal entry" || true
fi

# ── Seed journal index ──
if [ ! -f JOURNAL_INDEX.md ]; then
    echo "→ Creating JOURNAL_INDEX.md..."
    echo "# Journal Index" > JOURNAL_INDEX.md
    echo "" >> JOURNAL_INDEX.md
    echo "| Day | Date | Time | Coverage | Summary |" >> JOURNAL_INDEX.md
    echo "|-----|------|------|----------|---------|" >> JOURNAL_INDEX.md
    echo "| 0 | $DATE | $SESSION_TIME | 0/? | Bootstrap: scaffolded $LANGUAGE/$FRAMEWORK project |" >> JOURNAL_INDEX.md
    git add JOURNAL_INDEX.md
    git commit -m "Bootstrap: seed journal index" || true
fi

# ── Ensure initialized marker exists ──
if [ ! -f .baadd_initialized ]; then
    touch .baadd_initialized
    git add .baadd_initialized
    git commit -m "Bootstrap: mark project as initialized" || true
fi

# ── Wrap-up commit ──
git add -A
if ! git diff --cached --quiet; then
    git commit -m "Bootstrap: wrap-up"
fi

# ── Push ──
echo ""
echo "→ Pushing..."
git push || echo "  Push failed (check remote/auth)"

echo ""
echo "=== Bootstrap complete. Run evolve.sh (or wait for cron) to start Day 1. ==="
