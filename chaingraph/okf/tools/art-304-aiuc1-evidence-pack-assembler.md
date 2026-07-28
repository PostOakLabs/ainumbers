---
type: DecisionTool
title: "AIUC-1 Evidence Pack Assembler"
description: "Assembles a signed, AIUC-1 control-keyed evidence pack from execution receipts, escalation closures, and work mandates: binds each mapped control to its resolved artifact digests, computes pack_claim_strength as the honest minimum across bound controls, and exports an OSCAL Assessment Results document (arXiv:2604.13767 AI-evidence property-extension mapping, cited not vendored) plus an optional cadence attestation referencing the shipped aggregate_execution_receipts kernel. Verify-side evidence assembly only; never asserts these controls are certified or that any underwriter accepts the pack. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-304-aiuc1-evidence-pack-assembler.html
tags: ["compliance_mandate", "wave-54", "mcp:assemble_aiuc1_evidence_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-304-aiuc1-evidence-pack-assembler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-304-aiuc1-evidence-pack-assembler.html
    title: "public tool page"
---

# AIUC-1 Evidence Pack Assembler

> Exports a decision via MCP `assemble_aiuc1_evidence_pack` — mandate type `compliance_mandate`.

**Context:** Version-pinned to the same 2026-Q1 AIUC-1 catalog anchor as art-303; a mismatch REFUSES assembly.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-304-aiuc1-evidence-pack-assembler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AIUC-1 Control Evidence Linter](./art-303-aiuc1-control-evidence-linter.md), [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)

**Feeds:** [AIUC-1 Evidence Freshness Lint](./art-305-aiuc1-evidence-freshness-lint.md)
