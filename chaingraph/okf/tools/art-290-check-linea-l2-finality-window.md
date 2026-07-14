---
type: DecisionTool
title: "Linea L2 Finality Window Classifier"
description: "Classifies a tokenized-deposit transfer’s finality risk given L2-batch to L1-settlement timing: soft (unsubmitted), batched (submitted, not yet final), or l1_final tier, reorg-window risk, and a safe-to-release verdict against a corridor policy cutoff. Fills the L2 gap classify_settlement_asset_finality does not cover. Classifies supplied state only, never observes the chain or an RPC. Draft-pinned generic optimistic/batched L2 model; Linea-specific published finality windows were not found at STEP-0 re-verify (2026-07-13). Not check_cash_leg_finality or classify_settlement_asset_finality."
resource: https://ainumbers.co/chaingraph/art-290-check-linea-l2-finality-window.html
tags: ["compliance_mandate", "wave-53", "mcp:check_linea_l2_finality_window"]
timestamp: 2026-07-14
---

# Linea L2 Finality Window Classifier

> Exports a decision via MCP `check_linea_l2_finality_window` — mandate type `compliance_mandate`.

**Context:** Swift shared-ledger MVP live 2026-07-09; deposit-token interop checker trigger fired.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-290-check-linea-l2-finality-window.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
