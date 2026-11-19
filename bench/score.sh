#!/usr/bin/env bash
# Re-score every recorded sample. Usage: bash bench/score.sh
set -u
cd "$(dirname "$0")/.." || exit 1
printf "%-24s %6s %6s %6s %6s\n" sample score total P1 P2
for f in bench/samples/*.html; do
  [ -e "$f" ] || continue
  node scripts/slop-lint.mjs "$f" --json | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const r = JSON.parse(s).summary;
      const name = process.argv[1].split("/").pop();
      console.log(
        [name.padEnd(24), String(r.score).padStart(6), String(r.findings).padStart(6),
         String(r.bySeverity.P1).padStart(6), String(r.bySeverity.P2).padStart(6)].join(" "),
      );
    });
  ' "$f"
done
