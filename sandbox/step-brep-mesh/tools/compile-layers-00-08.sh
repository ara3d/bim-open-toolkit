#!/bin/bash
# Merge check: compile layers 00 to 08 alone (no spec files) with the stdlib tiers
# regen-step-brep.ps1 uses, from the working tree. Layers 09 to 11 must not be needed
# by 00 to 08; a compile that fails here fails the regeneration too.
# Usage: compile-layers-00-08.sh [work dir] [Plato CLI dll]
set -e
LIB="$(cd "$(dirname "$0")/.." && pwd)"
W="${1:-${TMPDIR:-/tmp}/compile-layers-00-08}"
CLI="${2:-C:/Users/cdigg/.plato-cli/c8c83c8b/Plato.CLI.dll}"
PLATO=/c/Users/cdigg/git/plato
# The tiers, excluded stdlib names and layers come from shipped-program.txt, the one list plato_laws.py reads too.
LIST="$(dirname "$0")/shipped-program.txt"
TIERS=$(awk '$1 == "stdlib" { print $2 }' "$LIST")
EXCLUDE=$(awk '$1 == "exclude" { for (i = 2; i <= NF; i++) print $i }' "$LIST")
LAYERS=$(awk '$1 == "layer" { print $2 }' "$LIST")
rm -rf "$W"; mkdir -p "$W/in/library" "$W/out"
INPUTS=()
for t in $TIERS; do
  mkdir -p "$W/in/$t"
  INPUTS+=("$(cygpath -m "$W")/in/$t")
  for f in "$PLATO/stdlib/$t"/*.plato; do
    keep=1
    for g in $EXCLUDE; do case "$(basename "$f")" in $g) keep=0;; esac; done
    [ $keep = 1 ] && cp "$f" "$W/in/$t/"
  done
done
INPUTS+=("$(cygpath -m "$W")/in/library")
for l in $LAYERS; do
  for f in "$LIB/$l"/*.plato; do
    case "$f" in *.spec.plato) ;; *) cp "$f" "$W/in/library/";; esac
  done
done
cd "$PLATO"
set +e
dotnet "$CLI" "${INPUTS[@]}" \
  --out="$(cygpath -m "$W")/out" --profile=cpu64 > "$W/log.txt" 2>&1
code=$?
tail -3 "$W/log.txt"
echo "error lines: $(grep -ciE '\[Error\]|RESOLVE' "$W/log.txt")"
echo "exit $code"
exit $code
