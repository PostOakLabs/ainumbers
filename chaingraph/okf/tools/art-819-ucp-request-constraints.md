---
type: DecisionTool
title: "Ucp Request Constraints"
description: "Deterministic, verify-only preflight of a caller-pasted Universal Commerce Protocol (UCP) request against a caller-pasted set of ucp.request_constraints values, per the Request Constraints section of the 2026-08-25 overview (tag v2026-08-25 of github.com/Universal-Commerce-Protocol/ucp, Apache-2.0). Evaluates the closed constraint grammar (required, properties, anyOf, enum, const) against every object each value's path selects; an omitted path falls back to the caller-supplied Normalized Path of the object that held ucp. Paths are evaluated with a minimal inline RFC 9535 subset: root, child member, index, wildcard, and equality filters joined by &&, which covers every path in the spec's own examples; anything else is INDETERMINATE with UNSUPPORTED_PATH, never a guess. Verdict SATISFIED, VIOLATED or INDETERMINATE, listing each violated constraint with its path and reason. A malformed value (including an empty or path-carrying anyOf branch) is CONSTRAINT_MALFORMED, a value whose path selects a non-object is skipped, and contradictory const or enum constraints on one object are reported as CONSTRAINT_CONTRADICTION (an authoring error, verdict INDETERMINATE). A missing constraints set means nothing to check. Input size and depth are bounded and over-bound input is INDETERMINATE. Declared exclusions: the resolved request schema is not checked, Business runtime outcomes are not modelled, and the node never fetches a profile, a key or a merchant endpoint."
resource: https://ainumbers.co/mcp.html
tags: ["compliance_control", "wave-142", "mcp:eval_ucp_request_constraints"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-819-ucp-request-constraints.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/mcp.html
    title: "public tool page"
---

# Ucp Request Constraints

> Exports a decision via MCP `eval_ucp_request_constraints` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/mcp.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-819-ucp-request-constraints.md) — §10.2.
