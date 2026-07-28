---
type: DecisionTool
title: "226J Response Evidence Pack Builder"
description: "Terminal node of the aca-226j-response-composer chain: assembles a replayable evidence pack responding to an IRS Letter 226J proposed Employer Shared Responsibility Payment assessment. Recomputes the affordability and exposure position against the IRS-asserted figure, computes the response-window deadline from the supplied letter date, and records a named-HR/benefits-officer attestation closure (mirrors the shipped ML-2 escalation-closure pattern). Not a guarantee of abatement -- this is the employer's replayable dispute evidence, never a determination of liability. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-300-aca-226j-response-evidence-pack.html
tags: ["compliance_mandate", "wave-48", "mcp:build_226j_response_evidence_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-300-aca-226j-response-evidence-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-300-aca-226j-response-evidence-pack.html
    title: "public tool page"
---

# 226J Response Evidence Pack Builder

> Exports a decision via MCP `build_226j_response_evidence_pack` — mandate type `compliance_mandate`.

**Context:** Letter 226J response-window length DRAFT-PINNED at 30 days pending a confirmed Rev. Proc. citation -- re-verify before relying on the computed deadline

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-300-aca-226j-response-evidence-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [ACA Employer Shared Responsibility Payment Exposure Calculator](./art-299-aca-esrp-exposure.md)

**Feeds:** _terminal node_
