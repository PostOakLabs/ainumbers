---
type: DecisionTool
title: "Event Contract Terms Lint"
description: "Lints a prediction-market event contract's DECLARED settlement terms (source agency kind, unresolvable-outcome fallback, revision rule, expiration-value rule, discretion clause, outcome review availability, dispute window, settlement delay bound, early-close rule, carve-out flag, outcome exhaustiveness and exclusivity) against a caller-declared policy, and emits one PASS or FINDING line per declared policy item plus one intrinsic consistency check, with an overall verdict of PASS, PASS_WITH_FINDINGS or FAIL. Venue-neutral: the only profile knowledge is a closed data table (kalshi_rulebook_v1_29, generic) that marks which finding items carry a pinned primary-text basis; findings cite opaque rule_key identifiers that the node page maps to the pinned passages. Inputs are enums, booleans, integers and opaque labels only -- prose, URLs and identifier-like values are refused, never echoed. The node never says a contract is lawful, fair or compliant, and names no venue as compliant; resolution lifecycle work belongs to the parked PM-RESOLUTION-VERIFY design and pricing to art-211 and art-212."
resource: https://ainumbers.co/chaingraph/806-event-contract-terms-lint.html
tags: ["compliance_control", "wave-142", "mcp:lint_event_contract_terms"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/806-event-contract-terms-lint.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/806-event-contract-terms-lint.html
    title: "public tool page"
---

# Event Contract Terms Lint

> Exports a decision via MCP `lint_event_contract_terms` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/806-event-contract-terms-lint.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/806-event-contract-terms-lint.md) — §10.2.
