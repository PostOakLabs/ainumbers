---
type: DecisionTool
title: "CBPR+ Structured Address Linter"
description: "Lints a single pacs.008 PostalAddress24 block against the SWIFT CBPR+ November 2026 mandate. Detects unstructured AdrLine-only addresses (prohibited), hybrid silent-fail duplication (AdrLine echoing structured field values, which causes STP rejection without a visible error code), and address structure type (FULLY_STRUCTURED, HYBRID, UNSTRUCTURED, EMPTY). Per-message lint -- for batch verification of migrated address archives use verify_address_migration_batch (rca-03)."
resource: https://ainumbers.co/chaingraph/art-241-cbpr-structured-address-linter.html
tags: ["compliance_mandate", "wave-41", "mcp:lint_cbpr_structured_address"]
timestamp: 2026-07-14
---

# CBPR+ Structured Address Linter

> Exports a decision via MCP `lint_cbpr_structured_address` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-241-cbpr-structured-address-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [pacs.008 Party Completeness Validator](./art-242-pacs008-party-completeness-validator.md)
