---
type: DecisionTool
title: "CycloneDX SBOM Validator (EU CRA Annex I)"
description: "Validates a CycloneDX SBOM against the EU CRA Annex I machine-readable SBOM requirement: bomFormat=CycloneDX, specVersion in [1.4,1.5,1.6], all components carry purl+name+version, top-level dependencies array present. Emits sbom_valid verdict and per-component gap list. Root stage of sbom-provenance-attestation chain."
resource: https://ainumbers.co/chaingraph/art-135-cyclonedx-sbom-validator.html
tags: ["compliance_mandate", "wave-25", "mcp:validate_cyclonedx_sbom"]
timestamp: 2026-07-14
---

# CycloneDX SBOM Validator (EU CRA Annex I)

> Exports a decision via MCP `validate_cyclonedx_sbom` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-135-cyclonedx-sbom-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [SLSA Provenance Verifier](./art-136-slsa-provenance-verifier.md)
