# __boundary_mr__ — metamorphic boundary-direction relations pilot (BOUNDARY-MR-PILOT-1)

For a threshold shared by two kernels (supplier publishes T, consumer applies T),
generate input pairs at T and T±epsilon and require BOTH sides to flip verdicts at
the same point, in the same direction. Turns the boundary-semantics audit's hand
checks into generated, self-checking pairs.

- 3 families, selected MECHANICALLY from CONSUMES-EDGE-CHECK-1's scan on origin/main
  (2026-09-07 run: exactly 3 edge measurements, all with art-220 as supplier):
  - **B1** `art-218 → art-220` (BYTE-EQUAL, UNDECLARED-CONSUMER) — QM points-and-fees limits
  - **B2** `art-234 → art-220` (MISMATCH, declared while CCPP-FIX-ART234-1 open) — HOEPA floor + APR spreads
  - **B3** `art-235 → art-220` (BYTE-EQUAL, only declared spread-table edge) — HPML spread tiers
- 4 relations / 234 cases. `P-B2` DECLARES VIOLATION (the known 2021-2024 floor
  divergence — a finding, never silently fixed here).
- Idiom mirrors `../__consistency__/` exactly: declared expectations, surprises-exit
  (exit 1 on any observed-vs-declared mismatch, in either direction), `--red` control.
- RED control: `red-control/art-218-pass-comparator-flipped.perturbed.mjs` is a scratch
  copy of art-218 with ONE comparator mutation (`<= limit + 0.005` → `< limit - 0.005`);
  `--red` proves P-B1 goes red against it. ⛔ Never imported by anything real.

Run:

    node chaingraph/kernels/__boundary_mr__/run-boundary-mr.mjs          # exit 0 (all AS-DECLARED)
    node chaingraph/kernels/__boundary_mr__/run-boundary-mr.mjs --red    # exit 0 iff control fires
    node chaingraph/kernels/__boundary_mr__/run-boundary-mr.mjs --json

⛔ PILOT. Deliberately NOT wired into preflight or CI (row fence: no gate wiring).
Kernel bytes untouched — kernels are imported for probing only, nothing is written.
