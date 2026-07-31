---
type: DecisionTool
title: "Consortium Validator Reward-Flow Related-Party Classifier"
description: "Answers the question a consortium controller faces at quarter-end close on a permissioned Avalanche Evergreen L1: are any of the reward-manager precompile's payment recipients related parties of the reporting entity, and is what they received material. Takes a transcribed recipient list, the caller's own entity-ownership map, per-period reward amounts transcribed from the institution's own accounting export, a materiality threshold and a ruleset_version, and returns a per-recipient classification (same ultimate parent as the issuer, co-consortium member, unrelated, or unresolved), the aggregate related-party amount measured against the threshold, a gap list that names every recipient it could not resolve, and clearly-labelled draft ASC 850 / IAS 24 disclosure-note language. Own versioned ruleset carried in policy_parameters and echoed into the receipt: no ruleset is imported from any other control family, so one family's ruleset edit cannot move this node's hash. Flags, amounts and the pinned ASC 850 and IAS 24 citations are emitted unconditionally; the draft note is a convenience layer on top of them and is labelled DECISION-SUPPORT DRAFT, never legal or accounting advice. No coverage ratio and no percentage of recipients classified: the permitted form is a gap list naming each unresolved recipient. No chain observation, no RPC, no P-Chain query: recipients and amounts are transcribed by the caller. Not X: use art-459 for a segregation-of-duties conflict matrix over role assignments; this node classifies payment recipients against a group ownership structure. compliance_control. Zero PII: every recipient, entity and parent reference is an opaque caller-supplied string, and unmapped fields on caller objects are dropped rather than echoed."
resource: https://ainumbers.co/chaingraph/art-498-reward-flow-related-party.html
tags: ["compliance_control", "wave-78", "mcp:classify_reward_flow_related_party"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-498-reward-flow-related-party.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-498-reward-flow-related-party.html
    title: "public tool page"
---

# Consortium Validator Reward-Flow Related-Party Classifier

> Exports a decision via MCP `classify_reward_flow_related_party` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-498-reward-flow-related-party.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-498-reward-flow-related-party.md) — §10.2.
