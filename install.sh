#!/usr/bin/env bash
set -euo pipefail

REPO="dweng0/BAADD"
RAW_BASE="https://raw.githubusercontent.com/${REPO}"
API_BASE="https://api.github.com/repos/${REPO}"
MANIFEST_FILE=".baadd"

# ── Argument parsing ──────────────────────────────────────────────────────────
VERSION=""
FORCE_UPDATE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --update)  FORCE_UPDATE=true; shift ;;
    --version) VERSION="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: install.sh [--update] [--version vX.Y.Z]"
      echo ""
      echo "  (no args)          Init a new BAADD project in the current directory"
      echo "  --update           Update framework files in an existing BAADD project"
      echo "  --version vX.Y.Z   Pin to a specific BAADD version (default: latest)"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Auto-detect update mode if manifest already exists
if [[ -f "$MANIFEST_FILE" && "$FORCE_UPDATE" == false ]]; then
  FORCE_UPDATE=true
fi

# ── Resolve version ───────────────────────────────────────────────────────────
if [[ -z "$VERSION" ]]; then
  echo "Fetching latest BAADD version..."
  VERSION=$(curl -fsSL "${API_BASE}/releases/latest" \
    -H "Accept: application/vnd.github+json" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])")
  echo "Latest: $VERSION"
fi

RAW="${RAW_BASE}/${VERSION}"

# ── Helpers ───────────────────────────────────────────────────────────────────
download() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  curl -fsSL "${RAW}/${file}" -o "$file"
  echo "  $file"
}

read_manifest_files() {
  python3 -c "import json; [print(f) for f in json.load(open('${MANIFEST_FILE}'))['files']]"
}

stamp_version() {
  python3 - <<EOF
import json
with open("${MANIFEST_FILE}") as f:
    m = json.load(f)
m["version"] = "${VERSION}"
with open("${MANIFEST_FILE}", "w") as f:
    json.dump(m, f, indent=2)
    f.write("\n")
EOF
}

# ── Update mode ───────────────────────────────────────────────────────────────
if [[ "$FORCE_UPDATE" == true ]]; then
  CURRENT=$(python3 -c "import json; print(json.load(open('${MANIFEST_FILE}'))['version'])" 2>/dev/null || echo "unknown")

  if [[ "$CURRENT" == "$VERSION" ]]; then
    echo "Already on BAADD ${VERSION}. Nothing to do."
    exit 0
  fi

  echo "Updating BAADD: ${CURRENT} → ${VERSION}"
  echo ""

  while IFS= read -r file; do
    download "$file"
  done < <(read_manifest_files)

  stamp_version
  chmod +x scripts/*.sh

  echo ""
  echo "BAADD updated to ${VERSION}."

# ── Init mode ─────────────────────────────────────────────────────────────────
else
  echo "Initializing BAADD ${VERSION}..."
  echo ""

  # Download manifest first — it defines what else to get
  download "$MANIFEST_FILE"
  stamp_version

  # Download all framework files
  while IFS= read -r file; do
    download "$file"
  done < <(read_manifest_files)

  # Create BDD.md from template if not already present
  if [[ ! -f "BDD.md" ]]; then
    cp BDD.example.md BDD.md
    echo "  BDD.md (created from template)"
  else
    echo "  BDD.md already exists — skipped"
  fi

  # Init git repo if needed
  if [[ ! -d ".git" ]]; then
    git init -q
    echo "  .git (initialized)"
  fi

  chmod +x scripts/*.sh

  echo ""
  echo "BAADD ${VERSION} ready."
  echo ""
  echo "Next steps:"
  echo "  1. Edit BDD.md — describe your project's features and scenarios"
  echo "  2. Add your API key to GitHub repo secrets (ANTHROPIC_API_KEY, etc.)"
  echo "  3. Push to GitHub — the agent runs automatically every 8 hours"
  echo ""
  echo "Or run locally:"
  echo "  pip install anthropic"
  echo "  ANTHROPIC_API_KEY=sk-... ./scripts/evolve.sh"
fi
