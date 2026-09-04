---
type: DecisionTool
title: "ORSA Readiness Pack"
description: "Deterministic ORSA readiness arithmetic over caller-declared synthetic inputs, checked against the duties inserted into Solvency II by Directive (EU) 2025/2. From a declared required scenario set, a declared scenario run set, and a declared liquidity-plan documentation flag, it computes: scenarios_missing as the required set minus the run set, preserving declared order; liquidity_plan as DOCUMENTED or MISSING; and an overall verdict of READY only when nothing is missing and the plan is documented, else NOT_READY. Optional declared capital-contingency and board sign-off references are echoed into the trace verbatim, never defaulted. Documentary anchor, outside the hashed preimage: transposition deadline 30 January 2027. No undertaking, no risk inventory store, no scenario engine, no supervisor, no network, no clock: every scenario, flag, and reference is a caller-declared input, never fetched or inferred. This is a readiness checker, NOT legal advice, NOT a materiality assessment, NOT a determination that any undertaking's ORSA satisfies the directive, and NOT a supervisory submission: nothing is filed anywhere. An absent or malformed scenario list or flag resolves to a fail-closed payload naming each rejected input, never a silently repaired assessment. Set and flag arithmetic over declared strings and booleans; it computes no numbers and cites no external standard beyond the directive articles recorded in its kernel source."
resource: https://ainumbers.co/tools/679-orsa-readiness-pack.html
tags: ["compliance_control", "wave-114", "mcp:compute_orsa_readiness_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-679-orsa-readiness-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/679-orsa-readiness-pack.html
    title: "public tool page"
---

# ORSA Readiness Pack

> Exports a decision via MCP `compute_orsa_readiness_pack` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/679-orsa-readiness-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-679-orsa-readiness-pack.md) — §10.2.
