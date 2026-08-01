---
type: DecisionTool
title: "Payment Data Migration Completeness"
description: "Verifies that data moved from a legacy system to a successor is complete, value-preserving, and reconcilable, using caller-declared per-partition source and target record counts and control totals rather than reading any dataset. Checks each declared partition for count and value completeness against a declared tolerance and known exclusions, and separately checks the aggregate (the sum of every partition) against the individual partitions -- a grand total that reconciles while one or more partitions underneath do not is flagged as the inconsistency it is, not passed silently. Also checks transformation coverage (fields observed to change value with no declared transformation rule) and flags any partition verified by sampling only as a residual-risk statement, never as equivalent to a full completeness verdict. Region-portable: every fact is a caller-declared input, with no country, currency, agency, or rail hardcoded. Deterministic arithmetic only. Zero data ingestion, zero PII."
resource: https://ainumbers.co/chaingraph/art-519-payment-data-migration-completeness.html
tags: ["attestation_mandate", "wave-80", "mcp:verify_migration_completeness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-519-payment-data-migration-completeness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-519-payment-data-migration-completeness.html
    title: "public tool page"
---

# Payment Data Migration Completeness

> Exports a decision via MCP `verify_migration_completeness` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-519-payment-data-migration-completeness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-519-payment-data-migration-completeness.md) — §10.2.
