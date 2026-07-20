# proposals/ — tool & workflow proposal schema

A PR against this repo may add **exactly one** file: `proposals/<kebab-slug>.json`,
matching `^[a-z0-9]+(-[a-z0-9]+)*\.json$`. **No other file may be touched** — CI
rejects any PR (fork or branch) that modifies paths outside `proposals/`.

This is the PR-contribution route for [AGENTS.md](../AGENTS.md) /
[CONTRIBUTING.md](../CONTRIBUTING.md). It sits alongside the GitHub Issue route
(`suggest.html` "Suggest on GitHub" card) — an issue is a request, a PR here is
a reviewable, CI-validated contribution.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `slug` | string | kebab-case, MUST match the filename (minus `.json`) |
| `name` | string | display name of the proposed tool/node/chain |
| `category` | string | one of: `tool`, `node`, `chain`, `guide`, `dataset`, `other` |
| `what_it_computes` | string | 1–2 sentences, plain language |
| `why_it_belongs` | string | the gap this fills / regulation or workflow it serves |
| `inputs` | array of strings | short names of the inputs a user/agent supplies |
| `outputs` | array of strings | short names of what the tool/node produces |

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `links` | array of strings | URLs to spec/reg text/prior art |
| `sample_artifact` | object | `{ policy_parameters, output_payload, execution_hash }` — a worked example. If `execution_hash` recomputes correctly from `policy_parameters`+`output_payload` via the canonical `executionHash()` lineage (`chaingraph/kernels/_hash.mjs` — no new verifier), CI applies a `receipt-verified` label. Working demonstrations outrank prose-only proposals in triage. |

## Out of scope

Proposals are **data, not code**. No kernel implementations, no HTML, no
`chaingraph.json` edits — a merged proposal enters the normal spec → work-unit
pipeline; it does not auto-build or auto-merge into the live suite. No
token/reward/reputation fields — GitHub's own identity, history, and spam
controls are the trust layer (see `AGENTS.md` "Moltbook doctrine" note).

## Validate locally

```bash
node scripts/verify-proposals.mjs proposals/<your-file>.json
```
