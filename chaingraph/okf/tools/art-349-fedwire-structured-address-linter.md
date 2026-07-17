---
type: DecisionTool
title: "Fedwire Structured Address Linter"
description: "Lints a Fedwire or CHIPS ISO 20022 PostalAddress24 block against the November 2026 structured-address mandate (network param selects fedwire or chips; rules verified byte-identical between the two networks at build time). On 2026-11-16 Fedwire and CHIPS remove the fully-unstructured postal address option in favor of a single hybrid format -- Town Name and Country always required, up to 2 supplemental AdrLine elements of 70 chars each. Detects unstructured AdrLine-only addresses (prohibited), hybrid silent-fail duplication (AdrLine echoing structured field values, which causes STP rejection without a visible error code), and address structure type (FULLY_STRUCTURED, HYBRID, UNSTRUCTURED, EMPTY). For the SWIFT CBPR+ cross-border equivalent use lint_cbpr_structured_address (art-241)."
resource: https://ainumbers.co/chaingraph/art-349-fedwire-structured-address-linter.html
tags: ["compliance_mandate", "wave-46", "mcp:lint_fedwire_structured_address"]
timestamp: 2026-07-14
---

# Fedwire Structured Address Linter

> Exports a decision via MCP `lint_fedwire_structured_address` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-349-fedwire-structured-address-linter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Fedwire Payment-File Address Sweep](./art-350-fedwire-address-sweep.md)
