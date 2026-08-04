---
type: DecisionTool
title: "Swift MT101 Coexistence Readiness Diff"
description: "Evaluates Swift CBPR+ MT101 message-type retirement readiness ahead of the 2026-11-14 coexistence deadline, when FI-to-FI bulk/multiple payment initiation drops MT101 (FIN) in favor of pain.001v9 (ISO 20022 MX). Caller declares the message format currently in production (MT101 or pain.001v9) and a structural self-declared readiness checklist -- does the sender's system already emit pain.001v9 for bulk FI-to-FI, is a fallback path staged, has the correspondent confirmed it can receive pain.001v9. The kernel deterministically recomputes `ready` and `days_to_deadline` from the fixed deadline constant and a caller-supplied `as_of_date`. Distinct from art-548 (Fedwire/CHIPS structured-address remediation, deadline 2026-11-16, a different sub-mandate one day apart)."
resource: https://ainumbers.co/tools/577-mt101-coexistence-readiness-diff.html
tags: ["compliance_mandate", "wave-84", "mcp:check_mt101_coexistence_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-551-mt101-coexistence-readiness-diff.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/577-mt101-coexistence-readiness-diff.html
    title: "public tool page"
---

# Swift MT101 Coexistence Readiness Diff

> Exports a decision via MCP `check_mt101_coexistence_readiness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/577-mt101-coexistence-readiness-diff.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-551-mt101-coexistence-readiness-diff.md) — §10.2.
