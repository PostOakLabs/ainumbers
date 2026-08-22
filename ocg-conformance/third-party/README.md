# Third-party kernel conformance submissions

Convention + schema for a party who is **not** AINumbers to submit a per-kernel
`execution_hash` conformance vector and have it validated structurally, with
no human reviewer in the loop. Full design rationale: workspace-root
`USERKERNEL-CONFORMANCE-BUILD-SPEC.md`. This directory implements that
spec's row 1 (`USERKERNEL-SCHEMA-1`): the directory convention and the two
JSON Schemas. It does **not** yet ship the CI Action that runs the checks
automatically on a PR (`USERKERNEL-CI-1`) or the generated roster section
(`USERKERNEL-ROSTER-1`) — those are later rows in the same sequence.

## Why a separate directory from `../vectors/`

`../vectors/` is a **house** corpus: every entry there is derived from a real,
shipped AINumbers kernel (see `../README.md`). A third party's submission
carries a different trust shape — we did not author it, did not review its
business logic, and make a narrower claim about it (see "What this does and
does not claim" below). Keeping it in its own directory, one subdirectory per
submitter, means:

- "Who authored this" survives a copy/paste of the manifest entry — it's the
  directory path, not a prose label that can be dropped.
- Each submitter's files live in their own subdirectory, so two submission
  PRs from different parties never touch the same file and can never
  conflict with each other — this is what makes a no-reviewer auto-merge CI
  flow (the follow-up row) safe to run unattended.

## Directory shape

```
ocg-conformance/third-party/
  README.md                          (this file)
  schemas/
    submitter.schema.json            (shape of every submitter.json)
    submission-manifest.schema.json  (shape of every manifest.json)
  validate-submission.mjs            (local validator -- run before opening a PR)
  <submitter-slug>/
    submitter.json                   (who submitted this, per schemas/submitter.schema.json)
    manifest.json                    (this submitter's vectors, per schemas/submission-manifest.schema.json)
    vectors/
      inputs/<id>.input.json         (policy_parameters)
      outputs/<id>.output.json       (output_payload)
  example-submitter/                 (worked example -- see below)
    ...
```

`<submitter-slug>` is a filesystem-safe slug for the submitter (e.g.
`octocat`); `<id>` inside `vectors/` is the full reverse-DNS-style vector id
from the manifest entry (e.g.
`io.github.octocat.simple-fee-calculator.input.json`).

## What a submission PR contains

One PR, touching only files under a single new
`ocg-conformance/third-party/<submitter-slug>/` directory:

1. `submitter.json` — see `schemas/submitter.schema.json` for the exact
   shape. In short: a display name, a contact URL, a verified GitHub
   identity, a derived reverse-DNS namespace, and the trust disclaimer text
   (verbatim, enforced by the schema as a `const`).
2. `manifest.json` — one entry per submitted kernel vector, each with the
   same four hash fields the house corpus uses (`../README.md`'s four-step
   algorithm, unchanged) plus a reverse-DNS `id`, the trust disclaimer, and a
   `conformance_witness` object.
3. `vectors/inputs/<id>.input.json` and `vectors/outputs/<id>.output.json` —
   the `policy_parameters` / `output_payload` pair for each vector.

## The three 2026 enhancements (binding on every submission)

Modelled on the MCP Registry reference model for third-party namespace
registration (`USERKERNEL-CONFORMANCE-BUILD-SPEC.md` row 1 note):

**(a) Verified-GitHub-identity binding, reverse-DNS naming.** Every
submitter's `namespace` is derived from their GitHub identity
(`io.github.<username>` for the default `github-pr-author` verification
method — the submission PR's own author field is the proof of control, no
separate OAuth handshake required). Every vector `id` in that submitter's
manifest is `<namespace>.<kernel-slug>`, so two submitters can name a kernel
identically without colliding, and a roster line's id alone tells you who
submitted it.

**(b) Machine-readable conformance witness.** Every manifest vector entry
carries a `conformance_witness` object: a CI run identifier + URL, a SHA-256
of the CI run's own result artifact, and a SHA-256 "fixture digest" over the
exact input/output byte pair that run checked. This is the same FV-status
evidence pattern used elsewhere in this repo (a claim is only as good as the
specific, replayable run it points at) applied to third-party submissions.
**This row ships every witness at `status: "pending"` with the rest of the
fields `null`** — there is no CI Action yet to populate them. `USERKERNEL-CI-1`
is the row that runs the check and fills them in.

**(c) Verbatim trust disclaimer.** Both `submitter.json` and every manifest
vector entry carry a `trust_disclaimer` field pinned by the schema as a JSON
Schema `const`, so it cannot be paraphrased, shortened, or dropped per
submission:

> Conformance-suite-pass is not a correctness guarantee, not an endorsement,
> and not an audit. AINumbers verifies formats; it does not verify facts.

## What this does and does not claim

Unchanged from `USERKERNEL-CONFORMANCE-BUILD-SPEC.md` sections 3.3/3.4 and
`../README.md`'s own scope note, restated here because it governs this
directory specifically:

- It verifies that a **stated** `{policy_parameters, output_payload}` pair
  hashes to the **stated** `execution_hash`, and that the envelope/manifest
  shapes validate. Nothing more.
- It does **not** verify the kernel's business logic, does **not** re-run or
  even require the submitter's source code, and does **not** verify the
  submitter's real-world identity beyond the GitHub account that opened the
  PR.
- A passing check never registers the kernel into `chaingraph.json`, never
  makes it callable via the MCP worker, and never grants it any runtime
  role. It only adds one line, once the roster row ships, to a public list
  of "this hash claim checked out."

## Worked example: `example-submitter/`

`example-submitter/` is a hand-authored, clearly-synthetic example (GitHub's
own `octocat` demo account) proving the two schemas and the file/hash
convention round-trip end to end — required by this row's spec ("no CI yet,
just the shapes + one hand-authored example vector"). It is not a real
submission and carries no special status; a real submitter's directory looks
exactly like it.

## Validating a submission locally (before CI exists)

```
node validate-submission.mjs example-submitter
node validate-submission.mjs path/to/your-submitter-dir
```

Checks, in order: `submitter.json` against its schema; `manifest.json`
against its schema; that `manifest.submitter_namespace` matches
`submitter.namespace`; that every vector `id` is namespaced under it; and,
for every vector, that the input/output file bytes, their canonicalized
JSON, and the resulting `execution_hash` all match what the manifest
declares — recomputed via `../../chaingraph/kernels/_hash.mjs`, the same
canonicalizer every AINumbers kernel uses (CONTRACT.md "one canonicalizer,
one shape"). This script never re-implements or hand-builds the hash
preimage itself.

Exit 0 = every check passed. Exit 1 = at least one failed, printed by name.
This script is what `USERKERNEL-CI-1`'s Action is expected to run against
every submission PR; running it yourself first catches the same failures
before you open one.
