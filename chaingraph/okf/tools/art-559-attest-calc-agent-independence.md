---
type: DecisionTool
title: "Calculation-Agent Independence Attestation"
description: "Receipts the organizational-independence claim a parametric trigger's neutrality depends on: that the entity whose kernel computed a specific art-251/art-252/art-309 execution_hash declares no controlling or compensating relationship with a named interested party (cedant, sponsor, reinsurer, or other) to the outcome that trigger determines. Self-declared attestation only -- exactly like art-373's declared inputs and art-306's self-asserted reputation field -- it attests that independence was DECLARED, never that it was verified against an external corporate registry. A counterparty party_id is plaintext by default; a caller may instead supply it as a sha256-salted@1 commitment (SPEC.md §25) to withhold the identifier while still binding the attestation to it. Not a determination of independence and not a legal or regulatory finding -- a citable record of what was declared, and to which specific trigger computation. Distinct from art-306, which scores AI-agent execution-evidence completeness for underwriter pricing and produces no independence claim. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-559-attest-calc-agent-independence.html
tags: ["attestation_mandate", "wave-91", "mcp:attest_calc_agent_independence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-559-attest-calc-agent-independence.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-559-attest-calc-agent-independence.html
    title: "public tool page"
---

# Calculation-Agent Independence Attestation

> Exports a decision via MCP `attest_calc_agent_independence` — mandate type `attestation_mandate`.

**Context:** A self-declared attestation carries no filing deadline; it is timestamped at generation and cites one trigger artifact by execution_hash.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-559-attest-calc-agent-independence.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-559-attest-calc-agent-independence.md) — §10.2.
