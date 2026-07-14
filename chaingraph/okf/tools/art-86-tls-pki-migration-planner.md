---
type: DecisionTool
title: "TLS / X.509 PKI Migration Planner"
description: "Sequences TLS and X.509 PKI migration from RSA/ECDSA to post-quantum algorithms (ML-KEM/ML-DSA per NIST FIPS 203/204 Aug 2024). Builds a phased plan (root CAs -> intermediates -> leaf certificates), models payload impact for hybrid/composite/replace strategies, and flags interoperability risks. Reuses CBOM inventory from tool 499."
resource: https://ainumbers.co/chaingraph/art-86-tls-pki-migration-planner.html
tags: ["compliance_mandate", "wave-18", "mcp:plan_tls_pki_migration"]
timestamp: 2026-07-14
---

# TLS / X.509 PKI Migration Planner

> Exports a decision via MCP `plan_tls_pki_migration` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-86-tls-pki-migration-planner.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [PQC Timeline & Migration Fit Diagnostic](./art-85-pqc-timeline-fit-diagnostic.md), `499-crypto-asset-inventory-classifier` _(not live)_

**Feeds:** [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
