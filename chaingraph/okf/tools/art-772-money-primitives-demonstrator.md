---
type: DecisionTool
title: "Money Primitives Demonstrator"
description: "Demonstrator node for the shared _money.bundle.mjs kernel: exact decimal parse (closed grammar -?digits(.digits)? at the caller-declared scale; exponent form, thousands separators, empty input and excess precision are named refusals, closing the silent-to-zero and silent-truncation defect class), integer minor-unit arithmetic on BigInt with no engine float anywhere on the value path, six named rounding modes in a closed set (half_up, half_down, half_even, truncate, floor, ceiling, all sign-correct; an unknown or missing token is a structured REFUSED_UNKNOWN_ROUNDING_MODE, never a fallback), single-rounding mul/div with a zero-divisor refusal, largest-remainder allocation whose parts sum exactly, and receipt-form strings. Rounds a caller-supplied amount to the currency exponent (or explicit places) with the required mode, allocates across integer weights, and echoes the mode and the matched currency-slice entry. Currency exponents arrive as DATA via policy_parameters.currency_slice (same ruling as the _ruleversion registry: data, never kernel bytes); the fixture slice reflects ISO 4217 Amendment 180 (BGN historic for Bulgaria from 2026-01-01, EUR effective). Not a migration target: existing sealed kernels are out of scope by row fence."
resource: https://ainumbers.co/mcp.html
tags: ["compliance_control", "wave-134", "mcp:money_primitives_demo"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-772-money-primitives-demonstrator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/mcp.html
    title: "public tool page"
---

# Money Primitives Demonstrator

> Exports a decision via MCP `money_primitives_demo` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/mcp.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-772-money-primitives-demonstrator.md) — §10.2.
