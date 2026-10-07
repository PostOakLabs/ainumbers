---
type: DecisionTool
title: "A2A Agent-Card Trust-Chain Validator"
description: "The horizontal agent-to-agent trust complement. Validates an A2A v1.0 agent card (schema, signature, extension URIs) then assesses the delegated-authority trust chain into KYA-OS attestation + spend policy: chain depth <= 4, no scope escalation, validity windows <= 90 days. Trust PASS/WARN/FAIL determination + execution_hash."
resource: https://ainumbers.co/chaingraph/art-32-a2a-agent-card-trust-chain-validator.html
tags: ["compliance_mandate", "wave-6", "mcp:validate_a2a_trust_chain"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-32-a2a-agent-card-trust-chain-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-32-a2a-agent-card-trust-chain-validator.html
    title: "public tool page"
---

# A2A Agent-Card Trust-Chain Validator

> Exports a decision via MCP `validate_a2a_trust_chain` — mandate type `compliance_mandate`.

**Deadline:** 2026-08 — A2A at Linux Foundation (150+ orgs); EU AI Act dates re-set by the Digital Omnibus on AI, Regulation (EU) 2026/1744 (in force 27 Jul 2026): Chapter III high-risk regime (Sections 1-3) applies 2 Dec 2027 for Art. 6(2)/Annex III systems and 2 Aug 2028 for Art. 6(1)/Annex I systems; Art. 50(2) synthetic-content marking for systems placed on the market before 2 Aug 2026 applies by 2 Dec 2026 (amended Art. 111(4)); new Art. 5(1) points (ba)/(bb) prohibitions likewise apply from 2 Dec 2026. These push agent KYA toward requirement.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-32-a2a-agent-card-trust-chain-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md)

**Feeds:** [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md), [Agent Spend-Policy Simulator](./art-02-agent-spend-policy-simulator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/art-32-a2a-agent-card-trust-chain-validator.md) — §10.2.
