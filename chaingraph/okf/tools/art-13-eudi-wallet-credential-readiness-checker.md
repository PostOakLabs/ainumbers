---
type: DecisionTool
title: "EUDI Wallet Credential-Acceptance Readiness Checker"
description: "eIDAS 2.0 verifiable-credential acceptance readiness against EUDI Wallet ARF v1.4 profiles. PID/QEAA/EAA attribute mapping, relying-party obligations, conformance gaps. Member-state wallet rollout Nov 2026; obliged-entity acceptance Dec 2027."
resource: https://ainumbers.co/chaingraph/art-13-eudi-wallet-credential-readiness-checker.html
tags: ["compliance_mandate", "wave-2", "mcp:check_eudi_readiness"]
timestamp: 2026-06-18T14:43:45.819Z
---

# EUDI Wallet Credential-Acceptance Readiness Checker

> Exports a decision via MCP `check_eudi_readiness` — mandate type `compliance_mandate`.

**Deadline:** 2026-11 — EUDI Wallet member-state rollout November 2026; FI SCA acceptance December 2027; AMLR July 2027

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-13-eudi-wallet-credential-readiness-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
