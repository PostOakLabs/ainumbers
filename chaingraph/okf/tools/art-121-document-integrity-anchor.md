---
type: DecisionTool
title: "Document Integrity & eIDAS Electronic Timestamp Anchor"
description: "Bind a document SHA-256 and claimed timestamp into an OCG execution_hash that serves as an eIDAS Art.41 / RFC 3161-aligned electronic timestamp: self-verifiable, no external TSA call. Optional C2PA manifest field. Feeds timestamp attestation verifier (art-122)."
resource: https://ainumbers.co/chaingraph/art-121-document-integrity-anchor.html
tags: ["compliance_mandate", "wave-22", "mcp:anchor_document_integrity"]
timestamp: 2026-07-14
---

# Document Integrity & eIDAS Electronic Timestamp Anchor

> Exports a decision via MCP `anchor_document_integrity` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-121-document-integrity-anchor.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Timestamp Attestation Verifier](./art-122-timestamp-attestation-verifier.md)
