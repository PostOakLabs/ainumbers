---
type: DecisionTool
title: "ERC-8004 Registry Entry Verifier"
description: "Checks whether a caller-supplied claimed ERC-8004 agent registry entry (Identity, Reputation, or Validation registry) and a caller-supplied on-chain record, independently read by the caller from the registry contract, agree field-by-field, and separately whether any address-shaped field in the on-chain record is EIP-55 checksum-valid. Zero network calls; this tool never queries a registry contract itself, so it makes no claim about the current on-chain state, only that the two supplied records are consistent with each other at the time supplied. Generic schema only, no per-registry-type adapter code -- the caller supplies both records as arbitrary key-value pairs. agent_id is compared as an opaque literal string throughout: never parsed as a number, never resolved against an Agent Card or A2A endpoint, never cached, and never cross-referenced against another registry. Two independently reported findings, never fused into one boolean."
resource: https://ainumbers.co/chaingraph/art-604-erc8004-registry-entry-verifier.html
tags: ["compliance_control", "wave-99", "mcp:verify_erc8004_registry_entry"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-604-erc8004-registry-entry-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-604-erc8004-registry-entry-verifier.html
    title: "public tool page"
---

# ERC-8004 Registry Entry Verifier

> Exports a decision via MCP `verify_erc8004_registry_entry` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-604-erc8004-registry-entry-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-604-erc8004-registry-entry-verifier.md) — §10.2.
