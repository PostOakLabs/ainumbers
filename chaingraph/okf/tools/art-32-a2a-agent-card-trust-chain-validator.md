---
type: DecisionTool
title: "A2A Agent-Card Trust-Chain Validator"
description: "The horizontal agent-to-agent trust complement. Validates an A2A v1.0 agent card (schema, signature, extension URIs) then assesses the delegated-authority trust chain into KYA-OS attestation + spend policy: chain depth <= 4, no scope escalation, validity windows <= 90 days. Trust PASS/WARN/FAIL determination + execution_hash."
resource: https://ainumbers.co/chaingraph/art-32-a2a-agent-card-trust-chain-validator.html
tags: ["compliance_mandate", "wave-6", "mcp:validate_a2a_trust_chain"]
timestamp: 2026-06-18T12:19:38.802Z
---

# A2A Agent-Card Trust-Chain Validator

> Exports a decision via MCP `validate_a2a_trust_chain` — mandate type `compliance_mandate`.

**Deadline:** 2026-08 — Wave 6 — A2A at Linux Foundation (150+ orgs); EU AI Act Aug 2026 pushes agent KYA toward requirement.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-32-a2a-agent-card-trust-chain-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md), [Agent Spend-Policy Simulator](./art-02-agent-spend-policy-simulator.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
