---
type: DecisionTool
title: "AIUC-1 Evidence Freshness Lint"
description: "Freshness lint keyed to the AIUC-1 quarterly re-test cadence: flags any control whose newest receipt is more than 90 days old and computes cert_expiry (cert_anniversary plus 12 months) with cert_expired / cert_expiring_within_days flags. Pure civil-calendar day-count arithmetic, never a Date object, so the verdict is byte-identical across browser, server, and zkVM guest. Freshness/expiry flags only, never a certification claim. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-305-aiuc1-evidence-freshness-lint.html
tags: ["compliance_mandate", "wave-54", "mcp:lint_insurance_evidence_freshness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-305-aiuc1-evidence-freshness-lint.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-305-aiuc1-evidence-freshness-lint.html
    title: "public tool page"
---

# AIUC-1 Evidence Freshness Lint

> Exports a decision via MCP `lint_insurance_evidence_freshness` — mandate type `compliance_mandate`.

**Context:** AIUC-1 quarterly re-test cadence (90-day staleness threshold) and a 12-month cert period are fixed constants documented in the kernel header, not annually indexed.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-305-aiuc1-evidence-freshness-lint.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AIUC-1 Evidence Pack Assembler](./art-304-aiuc1-evidence-pack-assembler.md)

**Feeds:** _terminal node_
