---
type: DecisionTool
title: "MiCA Register Presence Check"
description: "Answers one question about a pasted extract of an ESMA MiCA public register: was a named entity present in that snapshot on the date the reader captured it? The reader pastes the register extract (the register of crypto-asset white papers, or the register of authorised crypto-asset service providers), names the register type, supplies the entity identifier and supplies the capture date. The kernel digests the pasted bytes exactly as pasted into register_snapshot_digest, parses the extract with RFC 4180 quoting, searches either every cell or one caller-named column, and emits a single fixed verdict sentence: as of the retrieval date, the entity was or was not present in the named register snapshot with that digest. HARD FENCE: the extract, the entity identifier, the register type and the retrieval date are every one of them a caller input. This node performs no lookup of any kind (zero-egress), ships no bundled copy of either register, adds no scheduled refresh, and has no clock at all, so retrieval_date dates the reader's CAPTURE rather than the run. match_found is a tristate: null means the search did not run, and it is never collapsed into a false, because not looking and looking-and-not-finding are different facts. Oversized extracts are refused with a named flag rather than truncated, since a digest over bytes the reader never saw would be worse than no reading. Presence is a dated fact about a snapshot, never authorisation, never a current status, never a claim the register itself is complete or current, and never legal advice: absence proves absence from THAT PASTED TEXT, which a partial page, a filtered export or a different identifier spelling would each produce. Distinct from art-512-check-mica-reserve-disclosure, which checks a published reserve disclosure against caller-declared Article 30/36/37/54 terms, from art-102-crypto-asset-whitepaper-linter, which structurally lints a white paper rather than reading the register of white papers, and from tools/332-mica-casp-authorization-checker, which walks the authorisation question this node deliberately refuses to answer. None of those three is edited or imported. Out of scope: authorisation or status determination, live or scheduled register fetches, taxonomy and iXBRL validation, reserve arithmetic, and any coverage figure about our own estate."
resource: https://ainumbers.co/chaingraph/art-602-mica-register-presence-check.html
tags: ["compliance_mandate", "wave-99", "mcp:check_mica_register_presence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-602-mica-register-presence-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-602-mica-register-presence-check.html
    title: "public tool page"
---

# MiCA Register Presence Check

> Exports a decision via MCP `check_mica_register_presence` — mandate type `compliance_mandate`.

**Context:** No statutory deadline is encoded. The retrieval date is a caller input, because a bundled register snapshot or a scheduled refresh is a standing duty that goes silently false the day it is not chased.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-602-mica-register-presence-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-602-mica-register-presence-check.md) — §10.2.
