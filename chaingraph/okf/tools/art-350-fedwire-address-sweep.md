---
type: DecisionTool
title: "Fedwire Payment-File Address Sweep"
description: "Batch-sweeps a Fedwire or CHIPS payment file (CSV, one record per row) through the November 2026 structured-address mandate lint (lint_fedwire_structured_address, art-349) per record. Returns a rejection-risk report -- violation counts by rule and the worst offenders -- and a remediation-worksheet receipt (file digest, per-record findings digest, risk score), so a migration team can triage a whole payment file before the 2026-11-16 cutover instead of discovering rejections message-by-message in production. Reuses art-349's rule set rather than reimplementing it -- one kernel is the source of truth for Fedwire/CHIPS structured-address rules."
resource: https://ainumbers.co/chaingraph/art-350-fedwire-address-sweep.html
tags: ["compliance_mandate", "wave-46", "mcp:sweep_fedwire_addresses"]
timestamp: 2026-07-14
---

# Fedwire Payment-File Address Sweep

> Exports a decision via MCP `sweep_fedwire_addresses` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-350-fedwire-address-sweep.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Fedwire Structured Address Linter](./art-349-fedwire-structured-address-linter.md)

**Feeds:** _terminal node_
