---
type: DecisionTool
title: "Agent Identity & Authorization Attestation Checker"
description: "KYA-OS (DIF Trusted AI Agents WG) credential-chain attestation: delegated-authority credential chain, scope limits, validity windows (max 90 days), chain depth cap (4 hops), EU AI Act high-risk scope classification."
resource: https://ainumbers.co/chaingraph/art-04-agent-identity-attestation-checker.html
tags: ["compliance_mandate", "wave-2", "mcp:check_agent_attestation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-04-agent-identity-attestation-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-04-agent-identity-attestation-checker.html
    title: "public tool page"
---

# Agent Identity & Authorization Attestation Checker

> Exports a decision via MCP `check_agent_attestation` — mandate type `compliance_mandate`.

**Deadline:** 2027-12 — EU AI Act Annex III high-risk obligations (Digital Omnibus, Parliament final approval June 2026) push agent KYA toward compliance requirement from 2 December 2027; KYA-OS donated to DIF March 2026

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-04-agent-identity-attestation-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AP2 Mandate-Chain Validator](./art-01-ap2-mandate-chain-validator.md), [EUDI Wallet Credential-Acceptance Readiness Checker](./art-13-eudi-wallet-credential-readiness-checker.md)

**Feeds:** [Agent Spend-Policy Simulator](./art-02-agent-spend-policy-simulator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)

## Attested computation

[executor + attester binding](../computations/art-04-agent-identity-attestation-checker.md) — §10.2.
