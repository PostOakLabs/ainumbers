# CLINE-T2 — Doorway census reproduction (demo-safe set)

- **Status:** PROPOSED · 2026-09-09 · dispatcher: ZCode/GLM sweep · executor: Cline
- **Deliverable:** `C:\dev\Claude\Projects\AINumbers\research\WEBMCP-DOORWAY-CENSUS-REPRO-2026-09-09.md` (+ raw per-page JSON)
- **Scope guard:** report only. No edits to `repo/`, `board/`, or site sources.
- **Size note:** heaviest task in the queue; may be split into two Cline sessions
  (pages 1–48, 49–96). Keep one raw-JSON file per session.

## Claim under test

`research/shadow/WEBMCP-DOORWAY-CENSUS-2026-09-09.md` (a single shadow agent's run):

- **89 of 96** registered pages fail the census standard; only **7 PASS**:
  art-139, art-140, art-141, art-144, art-145, art-197, art-581 (:26-27), with the
  caveat that PASS partly rides on coinciding form defaults (:63-78).
- **7 of 57** pages return different execution hashes browser-vs-worker under
  page-exact params (including safe-set pages art-634/635); **17/57** payload
  divergence; deep-link-vs-worker disagreement 23/63 (:50-61).

**Verification status: UNCHALLENGED.** Executed once by one agent in one session;
nothing independent has reproduced the 89/96 list or the divergence counts. This list
governs what may be shown to an audience (`research/WEBMCP-DEMO-PROMPTS-2026-09-09.md`
exclusion list) — a census bug would mislabel unsafe pages as demo-safe, or kill
demonstrable pages that are actually fine.

## Task

1. Derive FIRST, compare SECOND: build your own census run before reading the census
   report's per-page table. You may read its classification definition (PASS = all four
   checks agree on verdict; A, C, D2 agree on hash — :18) to match methodology.
2. Re-run all 96 registered pages (list from the live
   `https://ainumbers.co/.well-known/webmcp.json`) through BOTH doorways — MCP worker
   call and deep-link page execution — with page-exact parameters, fresh tabs, and
   record every execution hash and verdict verbatim into per-page JSON rows.
3. Recompute per page: PASS / BROKEN (and the null/modal sub-verdicts the census uses),
   browser-vs-worker hash equality, payload equality.
4. Compare against the census table. For every disagreement, re-run that page a second
   time and adjudicate with quoted hashes; note any page where results are unstable
   across runs (that itself is a finding).
5. Answer explicitly: (a) does the 89/96 split reproduce? (b) do the 7 PASS pages
   reproduce as PASS for the right reasons (not merely coinciding defaults)? (c) do the
   7/57 and 17/57 divergence counts hold?

## Done when

- All 96 pages have both-doorway rows with hashes, machine-generated and quoted.
- Every disagreement vs the census is adjudicated with evidence, or marked unstable.
- The report states which of the 7 demo-safe pages are confirmed safe end-to-end.
