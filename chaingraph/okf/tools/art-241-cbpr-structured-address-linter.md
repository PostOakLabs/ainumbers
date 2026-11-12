---
type: DecisionTool
title: "CBPR+ Structured Address Linter"
description: "Lints a single pacs.008 PostalAddress24 block against the SWIFT CBPR+ structured-address rule set (formerly a 14 Nov 2026 mandate; deferred by Swift 27 Aug 2026 with all payments changes; new timeline expected December 2026, no new date published yet). Detects unstructured AdrLine-only addresses, hybrid silent-fail duplication (AdrLine echoing structured field values, which causes STP rejection without a visible error code), and address structure type (FULLY_STRUCTURED, HYBRID, UNSTRUCTURED, EMPTY). Per-message lint -- for batch verification of migrated address archives use verify_address_migration_batch (rca-03)."
resource: https://ainumbers.co/chaingraph/art-241-cbpr-structured-address-linter.html
tags: ["compliance_mandate", "wave-41", "mcp:lint_cbpr_structured_address"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-241-cbpr-structured-address-linter.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-241-cbpr-structured-address-linter.html
    title: "public tool page"
---

# CBPR+ Structured Address Linter

> Exports a decision via MCP `lint_cbpr_structured_address` — mandate type `compliance_mandate`.

**Context:** SWIFT CBPR+ structured-address requirement formerly 14 Nov 2026; deferred by Swift on 27 Aug 2026 (all payments changes deferred; Swift to define new timing and approach and provide an update by December 2026 at the latest, per its governance cycle); no successor date published, so deadline stays unset.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-241-cbpr-structured-address-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [pacs.008 Party Completeness Validator](./art-242-pacs008-party-completeness-validator.md)

## Attested computation

[executor + attester binding](../computations/art-241-cbpr-structured-address-linter.md) — §10.2.
