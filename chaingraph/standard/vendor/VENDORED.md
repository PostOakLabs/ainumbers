# Vendored standard-adjacent schemas (`chaingraph/standard/vendor/`)

Unlike `chaingraph/kernels/VENDORED.md` (whose digest gate guards crypto bytes that decide
verification), this directory holds pinned schema/spec artifacts that govern site-level
discovery formats. Each file names its upstream pin in a `_provenance` member (or a header
comment for non-JSON files). A pin moves only in the PR that updates the vendored bytes.

| File | Upstream | Pin | Licence | Retrieved |
|---|---|---|---|---|
| `ai-catalog.schema.json` | `github.com/Agent-Card/ai-catalog` | commit `b062278fd7f5a83202d33208f1d07c5b5eb7ccb3` (2026-08-27, `specification/ai-catalog.md`) | Apache-2.0 | 2026-09-05 |

## `ai-catalog.schema.json` — AI Catalog (Agentic Resource Discovery)

Upstream (Microsoft/GitHub/Hugging Face-backed AI Catalog WG, Apache-2.0) publishes the
format normatively as markdown and ships no machine-readable schema, so this file is a
draft-2020-12 SUBSET schema AUTHORED from the pinned primary text, not copied byte-for-byte.
The pinned spec snapshot lives at workspace-root
`research/clause-snapshots/ai-catalog-spec-b062278f.md`
(sha256 `b5ad5b6abcaf69e5ee87f8e4fd42e2b4399da70c6097f5d589e6a8cb02f4e45a`, retrieved
2026-09-05 from
`https://raw.githubusercontent.com/Agent-Card/ai-catalog/b062278fd7f5a83202d33208f1d07c5b5eb7ccb3/specification/ai-catalog.md`).

Consumer: `chaingraph/standard/schema-validate.mjs` validates `/.well-known/ai-catalog.json`
against this schema. The subset restriction (no `format`, no `not`, no `if/then`) is what the
shared zero-dependency validator in schema-validate.mjs implements; the entry-level
"exactly one of `url` / `data`" rule is expressed as a two-branch `oneOf`, which the
subset validator already evaluates as exactly-one-match.
