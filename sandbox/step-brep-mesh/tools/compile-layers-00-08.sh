#!/bin/bash
# Merge check: compile layers 00 to 08 alone (no spec files) with the stdlib tiers
# regen-step-brep.ps1 uses, from the working tree. Layers 09 to 11 must not be needed
# by 00 to 08; a compile that fails here fails the regeneration too.
# Usage: compile-layers-00-08.sh [work dir] [Plato CLI dll]
set -e
LIB="$(cd "$(dirname "$0")/.." && pwd)"
W="${1:-${TMPDIR:-/tmp}/compile-layers-00-08}"
CLI="${2:-C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll}"
PLATO=/c/Users/cdigg/git/plato
rm -rf "$W"; mkdir -p "$W/in/foundation" "$W/in/geometry" "$W/in/library" "$W/out"
for t in foundation geometry; do
  for f in "$PLATO/stdlib/$t"/*.plato; do
    case "$(basename "$f")" in brep.*|remeshing.*|lattices.*) ;; *) cp "$f" "$W/in/$t/";; esac
  done
done
for l in 00-foundation 01-geometry 02-topology 03-step 04-discretization 05-face-meshing 06-mesh 07-validation 08-pipeline; do
  for f in "$LIB/$l"/*.plato; do
    case "$f" in *.spec.plato) ;; *) cp "$f" "$W/in/library/";; esac
  done
done
cd "$PLATO"
set +e
dotnet "$CLI" "$(cygpath -m "$W")/in/foundation" "$(cygpath -m "$W")/in/geometry" "$(cygpath -m "$W")/in/library" \
  --out="$(cygpath -m "$W")/out" --profile=cpu64 > "$W/log.txt" 2>&1
code=$?
tail -3 "$W/log.txt"
echo "error lines: $(grep -ciE '\[Error\]|RESOLVE' "$W/log.txt")"
echo "exit $code"
exit $code
