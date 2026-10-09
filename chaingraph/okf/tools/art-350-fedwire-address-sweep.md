---
type: DecisionTool
title: "Fedwire Payment-File Address Sweep"
description: "Batch-sweeps a Fedwire or CHIPS payment file (CSV, one record per row) through the Fedwire structured-address rule lint (lint_fedwire_structured_address, art-349) per record. Returns a rejection-risk report -- violation counts by rule and the worst offenders -- and a remediation-worksheet receipt (file digest, per-record findings digest, risk score), so a migration team can triage a whole payment file ahead of the rescheduled November 2027 release (FRFS, 27 Aug 2026; exact date to be announced; until then Fedwire accepts unstructured and structured addresses) instead of discovering rejections message-by-message in production. Reuses art-349's rule set rather than reimplementing it -- one kernel is the source of truth for Fedwire/CHIPS structured-address rules."
resource: https://ainumbers.co/chaingraph/art-350-fedwire-address-sweep.html
tags: ["compliance_mandate", "wave-46", "mcp:sweep_fedwire_addresses"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-350-fedwire-address-sweep.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-350-fedwire-address-sweep.html
    title: "public tool page"
---

# Fedwire Payment-File Address Sweep

> Exports a decision via MCP `sweep_fedwire_addresses` — mandate type `compliance_mandate`.

**Context:** Fedwire structured-address removal rescheduled from the November 2026 release to the November 2027 release (FRFS, 27 Aug 2026); exact date to be announced; until then Fedwire accepts unstructured and structured addresses; CHIPS undated, aligned to the Fedwire cycle, TBC; no CHIPS date invented.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-350-fedwire-address-sweep.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Fedwire Structured Address Linter](./art-349-fedwire-structured-address-linter.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-350-fedwire-address-sweep.md) — §10.2.
