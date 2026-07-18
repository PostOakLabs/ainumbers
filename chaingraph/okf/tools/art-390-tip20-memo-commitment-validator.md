---
type: DecisionTool
title: "TIP-20 Memo/Commitment Validator"
description: "Validates a TIP-20 TransferWithMemo's 32-byte memo as a hash-or-locator commitment: checks length/hex form, recomputes the SHA-256 commitment over a supplied off-chain payload or a templated invoice-ID locator, and reports whether the memo matches. Integrity-only -- distinct from screen_tip20_transfer_batch (art-38, AML/Travel Rule screening of a transfer batch). Calculator only, zero egress."
resource: https://ainumbers.co/chaingraph/art-390-tip20-memo-commitment-validator.html
tags: ["compliance_mandate", "wave-65", "mcp:validate_tip20_memo_commitment"]
timestamp: 2026-07-14
---

# TIP-20 Memo/Commitment Validator

> Exports a decision via MCP `validate_tip20_memo_commitment` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-390-tip20-memo-commitment-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
