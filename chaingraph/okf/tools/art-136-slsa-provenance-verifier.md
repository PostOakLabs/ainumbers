---
type: DecisionTool
title: "SLSA Provenance Verifier"
description: "Verifies an in-toto SLSA provenance statement: validates _type (in-toto.io/Statement) and predicateType (slsa.dev/provenance), checks subject SHA-256 digest against caller-supplied artifact_digest_sha256, asserts builder.id present via runDetails.builder.id or predicate.builder.id, reports claimed_build_level 0-3. Middle stage of sbom-provenance-attestation chain."
resource: https://ainumbers.co/chaingraph/art-136-slsa-provenance-verifier.html
tags: ["compliance_mandate", "wave-25", "mcp:verify_slsa_provenance"]
timestamp: 2026-07-14
---

# SLSA Provenance Verifier

> Exports a decision via MCP `verify_slsa_provenance` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-136-slsa-provenance-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [CycloneDX SBOM Validator (EU CRA Annex I)](./art-135-cyclonedx-sbom-validator.md)

**Feeds:** [OpenVEX Statement Validator](./art-137-openvex-statement-validator.md)
