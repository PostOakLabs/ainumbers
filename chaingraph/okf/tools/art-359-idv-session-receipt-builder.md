---
type: DecisionTool
title: "IDV/KYC Session Evidence Receipt Builder"
description: "Hash-chains an identity-verification (IDV/KYC) session's declared results into a tamper-evident session receipt, per attempt: session metadata (verifier identity + version, timestamp), capture-chain attestation (C2PA manifest digest if present), injection-detection verdict, liveness verdict, document-check digest, and device-signal summary. Every verifier-sourced field is labeled asserted: this kernel attests the session record as declared, not detection quality or subject genuineness. Zero PII by construction: consumes only digests, booleans, and scores, and rejects any raw-data-shaped input (images, biometric templates) before compute proceeds."
resource: https://ainumbers.co/chaingraph/art-359-idv-session-receipt-builder.html
tags: ["compliance_control", "wave-62", "mcp:build_idv_session_receipt"]
timestamp: 2026-07-14
---

# IDV/KYC Session Evidence Receipt Builder

> Exports a decision via MCP `build_idv_session_receipt` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-359-idv-session-receipt-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
