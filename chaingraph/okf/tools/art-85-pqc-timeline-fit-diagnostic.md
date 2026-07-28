---
type: DecisionTool
title: "PQC Timeline & Migration Fit Diagnostic"
description: "12-dimension A-F diagnostic mapping an organisation's cryptographic estate and sector to the CNSA 2.0 / EU-2030 / G7 / DORA post-quantum milestones, flagging the end-2026 EU crypto-inventory deadline. Routes to the existing pqc-migration chain for inventory/HNDL/roadmap/agility and to the new protocol chains (TLS/PKI, SWIFT/ISO 20022, FIDO, blockchain)."
resource: https://ainumbers.co/chaingraph/art-85-pqc-timeline-fit-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-18", "mcp:run_pqc_timeline_fit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-85-pqc-timeline-fit-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-85-pqc-timeline-fit-diagnostic.html
    title: "public tool page"
---

# PQC Timeline & Migration Fit Diagnostic

> Exports a decision via MCP `run_pqc_timeline_fit` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-85-pqc-timeline-fit-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [TLS / X.509 PKI Migration Planner](./art-86-tls-pki-migration-planner.md), [SWIFT / ISO 20022 PQC Readiness Checker](./art-87-iso20022-pqc-readiness-checker.md), [FIDO2 / WebAuthn PQC Conformance Checker](./art-88-fido-pqc-conformance-checker.md), [Blockchain / Stablecoin Quantum-Risk Classifier](./art-89-blockchain-quantum-risk-classifier.md), `499-crypto-asset-inventory-classifier` _(not live)_, [Agent-Action Audit-Trail Aggregator](./cry-05-agent-action-audit-trail-aggregator.md)
