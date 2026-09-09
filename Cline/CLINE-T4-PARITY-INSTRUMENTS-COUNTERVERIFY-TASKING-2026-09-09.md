# CLINE-T4 — Parity instruments counter-verification (value-parity + surface-parity)

- **Status:** PROPOSED · 2026-09-09 · dispatcher: ZCode/GLM sweep · executor: Cline
- **Deliverable:** `C:\dev\Claude\Projects\AINumbers\research\PARITY-INSTRUMENTS-COUNTERVERIFY-2026-09-09.md` (+ raw sample JSON)
- **Scope guard:** report only. Work in a throwaway clone/worktree; no edits to
  `repo/`, `board/`, or site sources.

## Claims under test

**(a) Value-parity** — `research/VALUE-PARITY-PAIRGEN-1-REPORT-2026-09-05.md`:
657 kernels scanned → 55 candidates → **26 Tier-1 LIVE** pairs where the kernel carries
regulatory constants the public page never shows (:13-16, :27); art-220 alone has **28
kernel-only constants**. The selftest (:19-23) was executed by the same session that
wrote the generator. **UNCHALLENGED by any second agent.** These 26 pairs feed future
fix rows; false positives waste fix batches, false negatives leave regulatory values
invisible to users.

**(b) Surface-parity** — `research/SURFACE-PARITY-CLASSIFICATION-2026-09-03.md`:
624 pairs → **171 divergent** (164 class-a, incl. 40 value-only) (:6-7); **5 kernels'
fixtures hard-throw** attributed to a kernel-side salt defect (:52-54); 8 of 10
"pageless" kernels actually own pages (denominator undercount) (:34). The doc has **no
adjudication section** and no independent check. It drives the entire page-regen fix
batch queue, and the salt-defect attribution decides whether fixes land kernel-side or
page-side.

## Task

1. Derive FIRST: from a fresh clone/worktree of
   `C:\dev\Claude\Projects\AINumbers\repo`, re-derive both instruments independently —
   re-implement the constant-extraction pass for value-parity (do not trust the
   original generator's intermediate state), and re-run the surface-parity gate
   instrument from a clean checkout.
2. Re-derive the headline counts: 55/26 (a); 624/171/164/40/5/10 (b). Report deltas.
3. Hand-verify samples against primary sources:
   - 8–10 of the 26 Tier-1 value-parity pairs: diff the kernel constant against the
     live page copy; confirm the value is genuinely absent-or-divergent on the page;
   - 10 of the 171 surface divergences, **including all 5 hard-throw kernels**: for the
     throws, reproduce the failure and adjudicate the salt-defect attribution
     (kernel-side vs page-side vs harness-side) with quoted error output.
4. Adjudicate the "8 of 10 pageless" denominator claim by checking each of the 10.
5. Report structure: count table (original vs re-derived, with evidence class),
   per-sample adjudications with file:line quotes, reproduction commands, and proposed
   board rows for any defect (proposal only).

## Done when

- Both instruments re-derived from fresh checkouts with counts stated.
- 8–10 value-parity pairs and 10+ surface divergences (incl. all 5 throws) hand-verified
  and adjudicated.
- The salt-defect attribution is confirmed or overturned with quoted evidence.
