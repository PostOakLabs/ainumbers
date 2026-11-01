---
type: DecisionTool
title: "Private-Input Sanctions Screen"
description: "Demonstrates the private-input screening shape: screens a privately held party/transfer list against a fixed three-name synthetic test list by substring match, and emits a public verdict (screened, hit count, clean flag) without disclosing the party list. It is a demonstration of the screening shape, not a sanctions screen; the list version is a label the caller supplies, not bound to any list bytes. Carries an OCG Standard §25 ocg-private-input@1 declaration: the party list is committed via sha256-salted@1 in policy_parameters.parties_commitment, never in the clear. Private-input variant of screen_tip20_transfer_batch (art-38); use that public-input kernel when disclosure of the party list is acceptable; use this one when it is not. ZERO PII disclosed: only the verdict is public."
resource: https://ainumbers.co/chaingraph/art-413-screen-sanctions-private.html
tags: ["analytics_mandate", "wave-51", "mcp:screen_sanctions_private"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-413-screen-sanctions-private.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-413-screen-sanctions-private.html
    title: "public tool page"
---

# Private-Input Sanctions Screen

> Exports a decision via MCP `screen_sanctions_private` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-413-screen-sanctions-private.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-413-screen-sanctions-private.md) — §10.2.
