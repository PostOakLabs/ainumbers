---
type: DecisionTool
title: "GENIUS Act Reserve-Disclosure Conformance Monitor"
description: "Checks a monthly PPSI reserve disclosure against two statute-derived GENIUS Act S.394 §4 requirements: 1:1 reserve coverage arithmetic and attestation presence/timeliness against the statutory monthly cadence. Verdict per requirement (MET/NOT_MET/INDETERMINATE). NARROWED 2026-08-07: the permitted-asset composition check is out of scope because no final GENIUS Act implementing regulation exists as of that date (all OCC/FDIC/Treasury/FinCEN/NCUA instruments remain NPRM/ANPRM). Never claims final-rule attribution or compliance certification. Cross-links the shipped pre-issuance precheck_reserve_attestation (art-06) and the fuller check_genius_reserve_disclosure (art-275)."
resource: https://ainumbers.co/chaingraph/art-582-genius-reserve-disclosure-conformance-monitor.html
tags: ["compliance_mandate", "wave-55", "mcp:check_genius_reserve_disclosure_conformance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-582-genius-reserve-disclosure-conformance-monitor.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-582-genius-reserve-disclosure-conformance-monitor.html
    title: "public tool page"
---

# GENIUS Act Reserve-Disclosure Conformance Monitor

> Exports a decision via MCP `check_genius_reserve_disclosure_conformance` — mandate type `compliance_mandate`.

**Deadline:** 2027-01-18 — GENIUS Act effective date is the earlier of 18 Jan 2027 or 120 days after final implementing regulations publish; the statutory 18 Jul 2026 rulemaking deadline was missed and no final rule exists as of 2026-08-07 (research/GENIUS-FINALRULE-CHECK-2026-08-07.md). Re-verify against final-rule text once one publishes.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-582-genius-reserve-disclosure-conformance-monitor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-582-genius-reserve-disclosure-conformance-monitor.md) — §10.2.
