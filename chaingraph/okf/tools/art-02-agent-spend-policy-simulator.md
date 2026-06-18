---
type: DecisionTool
title: "Agent Spend-Policy Simulator"
description: "Simulates thousands of synthetic agent transactions against a user-authored spend policy (per-merchant caps, category allow/deny, velocity limits, cumulative ceilings). Flags scope creep and AP2 v0.2 Human-Not-Present policy-bypass paths."
resource: https://ainumbers.co/chaingraph/art-02-agent-spend-policy-simulator.html
tags: ["payment_policy", "wave-1", "mcp:simulate_spend_policy"]
timestamp: 2026-06-18T12:19:38.802Z
---

# Agent Spend-Policy Simulator

> Exports a decision via MCP `simulate_spend_policy` — mandate type `payment_policy`.

**Context:** AP2 v0.2 Human-Not-Present autonomous flows live

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-02-agent-spend-policy-simulator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [AP2 Mandate-Chain Validator](./art-01-ap2-mandate-chain-validator.md), [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
