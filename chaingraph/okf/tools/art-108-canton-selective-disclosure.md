---
type: DecisionTool
title: "Canton Selective-Disclosure DvP Reconciliation Attestation"
description: "Attest that a Canton DvP privacy partition is sound: each counterparty sees only its leg, no cross-leg data leaks, and both views reconcile to one shared commitment. Optional Ed25519 §​16 proof gives each party a non-repudiable attestation its partial view reconciles without seeing the counter-leg: the Canton selective-disclosure differentiator."
resource: https://ainumbers.co/chaingraph/art-108-canton-selective-disclosure.html
tags: ["attestation_mandate", "wave-21", "mcp:validate_canton_selective_disclosure"]
timestamp: 2026-07-14
---

# Canton Selective-Disclosure DvP Reconciliation Attestation

> Exports a decision via MCP `validate_canton_selective_disclosure` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-108-canton-selective-disclosure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Canton DvP Atomicity Validator](./507-canton-dvp-atomicity-validator.md)

**Feeds:** [ZK Compliance Proof Generator](./cry-01-zk-compliance-proof-generator.md)
