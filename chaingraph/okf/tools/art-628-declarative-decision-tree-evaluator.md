---
type: DecisionTool
title: "Declarative Decision-Tree Evaluator"
description: "Evaluates a caller-supplied, hash-pinned decision tree against caller-supplied facts entirely offline, client-side. The tree is inert data -- one audited interpreter walks it over a closed operator set (eq, in, lt, lte, gt, gte, between, all_of, any_of, none_of), never eval and never a function-valued criterion. Every node in the tree, internal criteria included and not leaves only, must carry a citation to a pinned clause snapshot; a tree with any uncited node is rejected by the loader. Independently recomputes the tree's own tree_digest from its bytes and refuses to evaluate on a mismatch -- never trusting the declared digest as an oracle for itself. Ships with a demonstrator tree exercising the Reg D Rule 501(a) entity-type accredited-investor category test (17 CFR 230.501(a)(1), (2), (3), (8), (9)), enumerated exhaustively over its 5 declared boolean fields (32 combinations, 0 unexplained results) because every criterion in that tree is a bounded enum. Never a full accredited-investor determination: the natural-person and numeric-threshold prongs of Rule 501(a) are explicitly out of this demonstrator's scope."
resource: https://ainumbers.co/chaingraph/art-628-declarative-decision-tree-evaluator.html
tags: ["compliance_mandate", "wave-100", "mcp:evaluate_decision_tree"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-628-declarative-decision-tree-evaluator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-628-declarative-decision-tree-evaluator.html
    title: "public tool page"
---

# Declarative Decision-Tree Evaluator

> Exports a decision via MCP `evaluate_decision_tree` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-628-declarative-decision-tree-evaluator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-628-declarative-decision-tree-evaluator.md) — §10.2.
