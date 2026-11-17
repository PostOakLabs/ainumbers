# Authoring standard: splitting a pinned clause into obligations

How to produce an obligation list (`chaingraph/obligations/<digest-hex>.json`) and a
coverage file (`chaingraph/obligations/coverage/<node-id>.json`). The split is the one
step in the obligation map that needs judgment; everything after it is mechanical and
gated (`scripts/check-obligation-coverage.mjs`). Helper: `node scripts/propose-obligation-split.mjs --excerpt <path> --digest <sha256:...>`
prints the split prompt and a skeleton; it calls no model itself.

## Who splits and who reviews

- The splitter is a model (or person) that **did not build the node** being covered.
- The reviewer is a **different** model family or person. Gate O1 refuses a list whose
  `reviewed_by` equals its `split_by`. Review means re-deriving every span from the
  excerpt bytes, not signing off; where two splitters disagree, both lists are kept in
  the review record and the finer one stands.

## How to split

1. **One obligation per testable sentence.** A sentence that a kernel could obey or
   ignore on its own is one obligation. Paragraph headings and chapeau connectors stay
   unassigned (their bytes simply fall outside every span).
2. **Exceptions are their own obligations.** A carve-out ("other than as provided
   in...") is an obligation of kind `exception`, not a footnote on the rule it carves.
3. **A cross-reference is an obligation of kind `definition`**, pointing at the other
   clause (for example an APOR defined in another section). Definitions need no vector
   of their own.
4. **Kinds:** `condition` (a scope or applicability requirement), `threshold` (a
   comparison against a number), `exception` (a carve-out), `definition` (a
   cross-reference to a meaning), `procedure` (a process the implementer must run,
   such as an annual adjustment), `deadline` (a date constraint). The deadline kind is
   available but only fits text that actually sets one.
5. **Keep the count between 3 and 25.** Finer is better than coarser (a coarser split
   hides branches), but an obligation nobody could ever test is noise. Measured
   baseline: two models split 2x to 4x apart in granularity and were both in range
   (OBLIGATION-PREMISE-1, P3).
6. **A source-code excerpt is one obligation** in v1: models agree worst on code
   (byte IoU 0.13 in the same premise run), so do not carve programs into spans.

## Spans

- A span is a **byte range** into the pinned excerpt, `start` inclusive and `end`
  exclusive (Buffer.slice semantics). Byte offsets, not character offsets: the
  excerpts carry multi-byte characters and the digest is over bytes.
- Spans must not overlap (O1 refuses overlap) and must sit inside `excerpt_bytes`.
- Verify every span against the bytes before review: `node scripts/propose-obligation-split.mjs --excerpt <path> --digest <sha256:...> --show-span 272,416`
  prints the bytes at a span so you can confirm the label describes them. Gate O5
  (span check against the local excerpt) lands in a later row; until then this check
  is the splitter's and reviewer's own discipline.
- Bytes outside every span are fine; the point of a span is to point, not to tile.

## Public-text rules

- The list and coverage files carry **byte offsets and our own short labels only**.
  Never quote the source text in any tracked file; the excerpt stays in the workspace
  clause-snapshot store, addressed by its digest.
- A label paraphrases: it names the legal test in our own words ("APR spread of more
  than 6.5 percentage points for a first-lien transaction"), long enough to be
  checkable against the span, short enough to print on a node page.

## How to cover a node

1. `covers` entries carry two vector-name lists: `accept` (vectors whose expected
   verdict is positive under that obligation) and `refuse` (negative or refusal
   because of it). Vector names must exist in the node's fixture file and their
   expected verdict class must match the side (gate O2, via the shared verdict
   reader).
2. When a node's verdict is per-obligation (for example one boolean per trigger),
   declare `signal`: a dot path into `output_payload` carrying that obligation's
   expected outcome. Without a signal the reader falls back to `compliance_flags`.
3. **Out of scope is a scope statement, never an apology**: an obligation the node
   deliberately does not implement gets `out_of_scope` with a plain reason; it prints
   on the node page in a later row.
4. **Uncovered is a defect**: an obligation with neither vectors nor an out-of-scope
   declaration goes in `uncovered` with a reason. Each uncovered obligation becomes
   its own follow-up row (add a vector, implement the branch, or declare out of
   scope); never fix one inside a backfill row.
5. A clause digest re-pin does not carry the old list over: a new digest means a fresh
   split (gate O4 lists coverage naming a digest the node no longer cites).
