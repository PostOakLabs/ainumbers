---
type: DecisionTool
title: "Timestamp Attestation Verifier"
description: "Recompute the document integrity anchor, confirm the document hash and timestamp claim match and the algorithm is consistent. Terminal stage of document-integrity-anchor chain."
resource: https://ainumbers.co/chaingraph/art-122-timestamp-attestation-verifier.html
tags: ["compliance_mandate", "wave-22", "mcp:verify_timestamp_attestation"]
timestamp: 2026-07-14
---

# Timestamp Attestation Verifier

> Exports a decision via MCP `verify_timestamp_attestation` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-122-timestamp-attestation-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Document Integrity & eIDAS Electronic Timestamp Anchor](./art-121-document-integrity-anchor.md)

**Feeds:** _terminal node_
