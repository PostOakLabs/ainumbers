---
type: DecisionTool
title: "UCP Checkout Payload Lint"
description: "Deterministic, verify-only structural lint of a caller-supplied Universal Commerce Protocol (UCP; Google + Shopify, announced NRF 2026-01-11, Apache-2.0 spec on GitHub) checkout resource against the schema pinned at tag v2026-04-08 of github.com/Universal-Commerce-Protocol/ucp. Checks the resource-level required[] field set, the status enum, ISO 4217 currency form, integer minor-unit amounts, and the exactly-one-subtotal / exactly-one-total cardinality rule on totals[]. Verdict CONFORMANT | NONCONFORMANT | UNKNOWN_VERSION: a payload declaring a UCP version outside the pinned allowlist is capped at UNKNOWN_VERSION regardless of otherwise-clean structure, never upgraded to CONFORMANT for a version this kernel has no pinned rules for. Never contacts a UCP or ACP endpoint and never fetches a live spec version -- the caller supplies the payload. UCP composes with AP2 rather than competing with it; part of the agentic-commerce-convergence chain alongside art-12 (ACP checkout conformance) and art-01 (AP2 mandate-chain validator)."
resource: https://ainumbers.co/chaingraph/art-564-ucp-checkout-payload-lint.html
tags: ["compliance_mandate", "wave-92", "mcp:lint_ucp_checkout_payload"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-564-ucp-checkout-payload-lint.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-564-ucp-checkout-payload-lint.html
    title: "public tool page"
---

# UCP Checkout Payload Lint

> Exports a decision via MCP `lint_ucp_checkout_payload` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-564-ucp-checkout-payload-lint.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-564-ucp-checkout-payload-lint.md) — §10.2.
