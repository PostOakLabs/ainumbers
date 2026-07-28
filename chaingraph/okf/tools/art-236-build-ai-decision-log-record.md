---
type: DecisionTool
title: "AI Decision Log Record Builder (EU AI Act Art 12)"
description: "Builds an EU AI Act Art 12(2)-conformant decision log record for high-risk AI systems in financial services. Computes chain_position (first/chained), art12_completeness_score (12 required fields), retention_months (>= 6 months, configurable), and anchor_surface instructions for composing anchor.ainumbers.co/mcp. subject_ref is a STRUCTURAL field only (opaque reference, never a real natural-person identifier; no PII enters this kernel). When the caller declares which sealed decision artifact this record evidences, this node also wraps it as a section-27.6 evidence bundle over that subject. Disambiguates from build_session_receipt (cry-01): that node logs MCP session I/O; this node builds a regulatory Art 12 decision record. Run classify_annex3_decisioning_obligations (art-238) first to confirm is_high_risk before generating Art 12 records."
resource: https://ainumbers.co/chaingraph/art-236-build-ai-decision-log-record.html
tags: ["compliance_mandate", "wave-40", "mcp:build_ai_decision_log_record"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-236-build-ai-decision-log-record.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-236-build-ai-decision-log-record.html
    title: "public tool page"
---

# AI Decision Log Record Builder (EU AI Act Art 12)

> Exports a decision via MCP `build_ai_decision_log_record` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-236-build-ai-decision-log-record.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agent Audit Trail Conformance Validator (IETF AAT)](./art-237-validate-agent-audit-trail.md), [EU AI Act Annex III FS Decisioning Obligations Classifier](./art-238-classify-annex3-decisioning-obligations.md)

## Attested computation

[executor + attester binding](../computations/art-236-build-ai-decision-log-record.md) — §10.2.
