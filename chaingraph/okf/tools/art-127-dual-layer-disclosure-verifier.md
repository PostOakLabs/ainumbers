---
type: DecisionTool
title: "Dual-Layer Disclosure Verifier"
description: "Confirm the EU Commission Code of Practice multi-layer requirement: both C2PA signed metadata and an imperceptible watermark (SynthID / Digimarc / TrustMark / c2pa.soft_binding) are declared present. Fails if only one layer present. Emits layers-present and missing-layer."
resource: https://ainumbers.co/chaingraph/art-127-dual-layer-disclosure-verifier.html
tags: ["compliance_mandate", "wave-23", "mcp:verify_dual_layer_disclosure"]
timestamp: 2026-07-14
---

# Dual-Layer Disclosure Verifier

> Exports a decision via MCP `verify_dual_layer_disclosure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-127-dual-layer-disclosure-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU AI Act Art. 50 Marking Checker](./art-126-ai-act-art50-marking-checker.md)

**Feeds:** [Content Binding Assertion Validator](./art-128-content-binding-assertion-validator.md)
