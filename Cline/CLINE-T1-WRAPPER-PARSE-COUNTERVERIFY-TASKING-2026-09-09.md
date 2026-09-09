# CLINE-T1 — Wrapper-parse 3/462 counter-verification

- **Status:** PROPOSED · 2026-09-09 · dispatcher: ZCode/GLM sweep · executor: Cline
- **Deliverable:** `C:\dev\Claude\Projects\AINumbers\research\WEBMCP-WRAPPER-PARSE-COUNTERVERIFY-2026-09-09.md` (+ ≤2 raw JSON/log artifacts alongside)
- **Scope guard:** report only. No edits to `repo/`, `board/`, or site sources.

## Claim under test

`research/WEBMCP-WRAPPER-PARSE-REPORT-2026-09.md` (workspace: `C:\dev\Claude\Projects\AINumbers\research\`)
states, of the WebMCP registration exclusion program:

- 525 tools excluded; of 465 mapping-incomplete, 462 had a detectable zero-arg wrapper,
  yielding **3 probe-proven committed** entries and **462 unbound** (report :41, :47).
- ~415 of the 462 unbound verdicts are blamed on `TODO_FUNCTION_NAME_REVIEW` manifest
  placeholders; the remainder on wrappers the parser refuses to chase (helpers computing
  values, scalars read outside the object literal, nested/computed leaves) (:48).
- Every committed entry is "probe-proven against the kernel's real fixture-0
  `golden_hash`" (:47).

**Verification status: self-verified only.** The parser, the vm fixture-hash probe, and
the selftest (:67-68) all come from the same author session; the report's "live browser
probe" section was prose-planned and never executed. No second agent or second parser
has checked any of it. A count drift 481→465 between staging and claim is also noted.

**Blast radius:** this map sizes the roadmap for registering ~500 currently-unregisterable
tools. If the parser is over-strict, "unbound" verdicts are wrong and the completion
program is mis-sized; if too loose, committed registrations lie.

## Task

1. Derive FIRST, report SECOND: do not read the report above until step 4.
2. From primary sources — vendored `chaingraph.json`, the manifests under
   `C:\dev\Claude\Projects\AINumbers\repo\chaingraph\standard\` (or the site's served
   copies), and the live tool pages — independently classify the same population into
   committed / mapping-incomplete / wrapper-detectable. Write your own binding parser
   or detection script (zero-dependency is fine; do not import the original's).
3. Live-probe a stratified sample against the real pages:
   - all 3 "probe-proven" pages;
   - 40 random "unbound" pages;
   - 15 non-placeholder "unbound" pages (causes (b)/(c) from :48 — the ones most likely
     to be parser over-strictness).
   For each probed page, decide BOUND / UNBOUND / PARTIAL from actual page behavior:
   set the inputs, run the tool, and check whether the returned result/receipt reflects
   the values you sent or silently ran form defaults.
4. Then read the report and adjudicate: for every disagreement, quote the page source
   line or live behavior that settles it. Specifically answer: how many of the 462
   unbound verdicts flip under independent parsing + probing?
5. Report structure: claim table (theirs vs yours, with evidence class per cell),
   per-disagreement adjudications, reproduction commands, and proposed board rows for
   any defect found.

## Done when

- Independent classification covers the full population and the live probe covers ≥58
  pages across all three strata.
- Every disagreement with the original 3/462 split is adjudicated with quoted evidence.
- The report states plainly which verdicts are probe-proven vs derived.
