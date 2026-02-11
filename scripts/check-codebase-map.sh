#!/usr/bin/env bash
# Validate docs/CODEBASE_MAP.md against actual source files.
# Run from repo root: bash scripts/check-codebase-map.sh
# Exit 0 = map is accurate, 1 = discrepancies found.
#
# Path-aware: parses the map's ## / ### section structure to determine
# expected file paths, then checks BOTH directions:
#   Forward:  disk → map  (new files not yet documented)
#   Reverse:  map → disk  (stale entries for deleted/moved files)

set -euo pipefail

MAP="docs/CODEBASE_MAP.md"
ERRORS=0

if [ ! -f "$MAP" ]; then
  echo "ERROR: $MAP not found"
  exit 1
fi

# --- Parse map structure to build expected paths ---
# Reads ## headers for package root, ### headers for subdirectory,
# then extracts `filename.ts` entries to construct full paths.
declare -A MAP_PATHS
current_root=""
current_subdir=""

while IFS= read -r line; do
  # Package header: ## @fws/xxx (`packages/xxx/src/`)
  if [[ "$line" == "## @fws/"* ]]; then
    current_root=$(echo "$line" | sed -n 's/.*`\(packages\/[^`]*\)`.*/\1/p')
    current_subdir=""
  # Non-package ## header (Symbol Lookup, Import Patterns, etc.)
  elif [[ "$line" == "## "* ]]; then
    current_root=""
    current_subdir=""
  # Subdirectory header: ### dirname/ or ### dir/subdir/
  elif [[ "$line" == "### "* ]] && [ -n "$current_root" ]; then
    current_subdir=$(echo "$line" | sed -n 's/^### \([a-zA-Z0-9_/-]*\/\).*/\1/p')
  fi

  # Extract `filename.ts` entries within package sections
  if [ -n "$current_root" ]; then
    remainder="$line"
    while [[ "$remainder" =~ \`([a-z][a-z0-9_-]*\.ts)\` ]]; do
      fname="${BASH_REMATCH[1]}"
      if [ "$fname" != "index.ts" ]; then
        expected="${current_root}${current_subdir}${fname}"
        MAP_PATHS["$expected"]=1
      fi
      remainder="${remainder#*\`${fname}\`}"
    done
  fi
done < "$MAP"

# --- Build set of actual disk file paths ---
declare -A DISK_PATHS
while IFS= read -r file; do
  bn=$(basename "$file")
  if [ "$bn" != "index.ts" ]; then
    DISK_PATHS["$file"]=1
  fi
done < <(find packages/*/src -name '*.ts' ! -name '*.test.ts' ! -name '*.d.ts' ! -path '*/node_modules/*' 2>/dev/null)

# --- Forward check: every disk file should have a map entry ---
MISSING=0
for diskpath in "${!DISK_PATHS[@]}"; do
  if [ -z "${MAP_PATHS[$diskpath]+x}" ]; then
    if [ "$MISSING" -eq 0 ]; then
      echo "NEW files not in $MAP:"
    fi
    echo "  $diskpath"
    MISSING=$((MISSING + 1))
  fi
done

ERRORS=$((ERRORS + MISSING))

# --- Reverse check: every map entry should exist on disk ---
STALE=0
for mappath in "${!MAP_PATHS[@]}"; do
  if [ -z "${DISK_PATHS[$mappath]+x}" ]; then
    if [ "$STALE" -eq 0 ]; then
      if [ "$MISSING" -gt 0 ]; then echo ""; fi
      echo "STALE entries in $MAP (file no longer exists at expected path):"
    fi
    echo "  $mappath"
    STALE=$((STALE + 1))
  fi
done

ERRORS=$((ERRORS + STALE))

# --- Result ---
if [ "$ERRORS" -eq 0 ]; then
  echo "Codebase map is up to date."
  exit 0
else
  echo ""
  if [ "$MISSING" -gt 0 ]; then
    echo "$MISSING file(s) not in map. Add entries to $MAP under the correct package/directory section."
  fi
  if [ "$STALE" -gt 0 ]; then
    echo "$STALE stale entry/entries. Remove or fix paths in $MAP."
  fi
  echo ""
  echo "Map format:  \`filename.ts\` — brief description  (under correct ## package / ### directory)"
  echo "After fixing: bash scripts/check-codebase-map.sh"
  exit 1
fi
