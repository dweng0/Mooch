#!/bin/bash
# setup_env.sh — Install language-specific toolchain based on BDD.md config.
# Called by evolve.sh before running the agent.
#
# Reads LANGUAGE from environment (set by parse_bdd_config.py).
# Add cases here for any language you need.

set -euo pipefail

LANGUAGE="${LANGUAGE:-unknown}"

echo "→ Setting up environment for language: $LANGUAGE"

case "$LANGUAGE" in

  rust)
    if ! command -v cargo &>/dev/null; then
      echo "  Installing Rust..."
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --quiet
      source "$HOME/.cargo/env"
    fi
    rustup component add clippy 2>/dev/null || true
    echo "  Rust $(rustc --version)"
    ;;

  node|javascript)
    if ! command -v node &>/dev/null; then
      echo "  Node not found — install it manually or use a setup-node action"
      exit 1
    fi
    echo "  Node $(node --version)"
    if [ -f package.json ]; then
      npm install --silent
    fi
    ;;

  typescript)
    if ! command -v node &>/dev/null; then
      echo "  Node not found — install it manually or use a setup-node action"
      exit 1
    fi
    echo "  Node $(node --version)"
    if [ -f package.json ]; then
      npm install --silent
    fi
    ;;

  python)
    if ! command -v python3 &>/dev/null; then
      echo "  Python3 not found"
      exit 1
    fi
    echo "  Python $(python3 --version)"
    if [ -f requirements.txt ]; then
      pip install -r requirements.txt --quiet
    fi
    if [ -f pyproject.toml ]; then
      pip install -e . --quiet 2>/dev/null || true
    fi
    ;;

  go)
    if ! command -v go &>/dev/null; then
      echo "  Go not found — install it manually or use a setup-go action"
      exit 1
    fi
    echo "  Go $(go version)"
    if [ -f go.mod ]; then
      go mod download 2>/dev/null || true
    fi
    ;;

  java)
    if ! command -v java &>/dev/null; then
      echo "  Java not found — install it manually or use a setup-java action"
      exit 1
    fi
    echo "  Java $(java --version 2>&1 | head -1)"
    ;;

  *)
    echo "  Unknown language '$LANGUAGE' — skipping toolchain setup."
    echo "  Add a case to scripts/setup_env.sh if you need auto-install."
    ;;

esac

# Always ensure agent dependencies are available
if command -v uv &>/dev/null; then
  PY_INSTALL="uv pip install --quiet"
else
  PY_INSTALL="python3 -m pip install --quiet"
fi
if ! python3 -c "import anthropic" &>/dev/null; then
  echo "  Installing anthropic Python package..."
  $PY_INSTALL anthropic
fi
if ! python3 -c "import openai" &>/dev/null; then
  echo "  Installing openai Python package..."
  $PY_INSTALL openai
fi

echo "  Environment ready."
