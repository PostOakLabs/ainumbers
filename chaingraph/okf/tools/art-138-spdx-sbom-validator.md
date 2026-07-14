---
type: DecisionTool
title: "SPDX SBOM Validator (EU CRA Annex I)"
description: "Validates an SPDX SBOM against the EU CRA Annex I machine-readable SBOM requirement: spdxVersion matches SPDX-2.x or SPDX-3.x, SPDXID present, all packages carry name+versionInfo+downloadLocation (or purl externalRef), relationships array non-empty. Emits sbom_valid verdict and per-package gap list. Root stage of cra-product-conformance chain."
resource: https://ainumbers.co/chaingraph/art-138-spdx-sbom-validator.html
tags: ["compliance_mandate", "wave-25", "mcp:validate_spdx_sbom"]
timestamp: 2026-07-14
---

# SPDX SBOM Validator (EU CRA Annex I)

> Exports a decision via MCP `validate_spdx_sbom` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-138-spdx-sbom-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [CRA Annex I Completeness Checker](./art-139-cra-annex1-completeness-checker.md)
