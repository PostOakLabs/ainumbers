---
type: DecisionTool
title: "Multicurrency JE Balance Check"
description: "Checks that structured journal entries balance, on a basis the caller declares: either every currency sums to zero separately (per_currency) or the caller-declared functional-currency amounts sum to zero (functional), always in integer minor units with debit positive. There is no default basis and none is inferred: the same USD +10800 / EUR -10000 currency-conversion entry is imbalanced on the per-currency basis and balanced on the functional basis, and the basis pair fixture proves both. A per-currency integer tolerance may be declared; the tolerance actually used is echoed in the output and is never inferred (the Beancount-style inferred-tolerance pattern is deliberately not used). Currency exponents are declared by the caller and only membership is checked -- the node does not fetch ISO 4217 and does not claim the declared exponents are authoritative. Amounts must be signed JSON integers checked with the safe-integer bound; non-integers are refused AMOUNT_NOT_INTEGER and integers beyond 2^53-1 are refused AMOUNT_UNSAFE_INTEGER, never coerced through floats. Named refusals cover the declared domain: BASIS_NOT_DECLARED, ENTRY_TOO_FEW_LINES, AMOUNT_NOT_INTEGER, AMOUNT_UNSAFE_INTEGER, UNKNOWN_CURRENCY, MISSING_FUNCTIONAL_AMOUNT, NEGATIVE_TOLERANCE, DUPLICATE_ENTRY_ID, DUPLICATE_LINE_ID, ENTRY_CAP_EXCEEDED. Out of scope in v1, stated plainly: the node does not recompute FX rates or check rounding lines -- functional_minor is a caller-declared input, taken as given. This node does NOT claim any entry is correct, approved or compliant; it claims only that an entry's arithmetic closes on the declared basis, or reports by how much it does not, and it does not claim the declared functional amounts or rates are right. Sibling relationship: art-653 is the plain-text, single-currency, two-decimal journal-entry verifier (parser plus Merkle evidence); this node is the structured, multi-currency, caller-declared-basis check and does not extend or alter art-653."
resource: https://ainumbers.co/chaingraph/art-791-check-je-multicurrency-balance.html
tags: ["compliance_control", "wave-140", "mcp:check_je_multicurrency_balance"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-791-check-je-multicurrency-balance.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-791-check-je-multicurrency-balance.html
    title: "public tool page"
---

# Multicurrency JE Balance Check

> Exports a decision via MCP `check_je_multicurrency_balance` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-791-check-je-multicurrency-balance.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-791-check-je-multicurrency-balance.md) — §10.2.
