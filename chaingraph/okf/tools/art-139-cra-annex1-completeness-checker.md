---
type: DecisionTool
title: "CRA Annex I Completeness Checker"
description: "Checks EU CRA Annex I Part I essential cybersecurity requirements: sbom_present, sbom_machine_readable, top_level_deps_covered, vuln_handling_policy_present, secure_by_default, and a valid conformity_route (self_assessment | eu_type_examination | full_quality_assurance). Emits annex1_complete verdict and ordered gap list with PDF export. Middle stage of cra-product-conformance chain."
resource: https://ainumbers.co/chaingraph/art-139-cra-annex1-completeness-checker.html
tags: ["compliance_mandate", "wave-25", "mcp:check_cra_annex1_completeness"]
timestamp: 2026-07-14
---

# CRA Annex I Completeness Checker

> Exports a decision via MCP `check_cra_annex1_completeness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-139-cra-annex1-completeness-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [SPDX SBOM Validator (EU CRA Annex I)](./art-138-spdx-sbom-validator.md)

**Feeds:** [CRA Vulnerability Reporting Readiness (Art. 14)](./art-140-cra-vuln-reporting-readiness.md)
