---
type: DecisionTool
title: "PSD3 / PSR Readiness Checker"
description: "Six-domain PSD3/PSR readiness rubric: Open Finance access rights (Art.35/36), TPP categorisation (PISP/AISP/PIISP), SCA exemption alignment (Art.85–90), consent framework maturity, fraud liability model (Art.59–65), and embedded finance/BaaS scope. Radar chart + prioritised gap table. Root node (no upstream dependency). Feeds ART-04 (DORA Mapper) and PTG-01. EU transposition ~2027; UK PSR enacted 2024."
resource: https://ainumbers.co/chaingraph/art-14-psd3-psr-readiness-checker.html
tags: ["compliance_mandate", "wave-4", "mcp:assess_psd3_readiness"]
timestamp: 2026-06-18T15:15:44.978Z
---

# PSD3 / PSR Readiness Checker

> Exports a decision via MCP `assess_psd3_readiness` — mandate type `compliance_mandate`.

**Deadline:** 2027-06-01 — EU PSD3 expected transposition ~2027; UK PSR enacted 2024 (APP reimbursement Oct 2024 already live)

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-14-psd3-psr-readiness-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
