---
type: DecisionTool
title: "Agent Insurability Evidence Scorer"
description: "Scores an agent execution evidence bundle for underwriter-facing evidence completeness across four dimensions (determinism, replayability, oversight density, dispute history) using a version-pinned rubric selected by underwriter_profile: aiuc, aisure (Munich Re aiSure evidence-doc list), armilla (KPI-warranty dimensions), or generic (equal-weight union). Optional incident_history (shared incident_record schema) and reputation inputs are supported; self-asserted reputation is recorded but zero-weighted in the composite. This scores evidence completeness only, never an insurability decision, a reserve attestation, or an insurable/not-insurable verdict -- selling or underwriting insurance is out of scope. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-306-agent-insurability-evidence-scorer.html
tags: ["compliance_mandate", "wave-54", "mcp:score_agent_insurability_evidence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-306-agent-insurability-evidence-scorer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-306-agent-insurability-evidence-scorer.html
    title: "public tool page"
---

# Agent Insurability Evidence Scorer

> Exports a decision via MCP `score_agent_insurability_evidence` — mandate type `compliance_mandate`.

**Context:** Rubric weight tables are version-tagged (rubric-2026-q1); a rubric revision bumps the version, not the fixed threshold logic.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-306-agent-insurability-evidence-scorer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Claim Dispute Bundle Builder](./art-307-claim-dispute-bundle-builder.md)

## Attested computation

[executor + attester binding](../computations/art-306-agent-insurability-evidence-scorer.md) — §10.2.
