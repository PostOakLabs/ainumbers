---
type: DecisionTool
title: "Camera-Provenance Check"
description: "Structural check on an IDV/KYC capture's C2PA manifest: claim well-formedness, hard-binding hash assertion, and claim-signature reference (art-123 reuse), plus a digitalSourceType read off the c2pa.actions assertion that flags trainedAlgorithmicMedia so a downstream reader knows the capture was declared AI-generated rather than a live camera capture. Structural check only, no trust-list or chain-of-trust claim. Feeds the session receipt builder's capture-chain field (art-359)."
resource: https://ainumbers.co/chaingraph/art-361-camera-provenance-check.html
tags: ["compliance_control", "wave-62", "mcp:check_camera_provenance"]
timestamp: 2026-07-14
---

# Camera-Provenance Check

> Exports a decision via MCP `check_camera_provenance` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-361-camera-provenance-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [IDV/KYC Session Evidence Receipt Builder](./art-359-idv-session-receipt-builder.md)
