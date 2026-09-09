# SPDX SBOM Validator (EU CRA Annex I)

Validates an SPDX SBOM against the EU CRA Annex I machine-readable SBOM requirement: spdxVersion matches SPDX-2.x or SPDX-3.x, SPDXID present, all packages carry name+versionInfo+downloadLocation (or purl externalRef), relationships array non-empty. Emits sbom_valid verdict and per-package gap list. Root stage of cra-product-conformance chain.

- Page: https://ainumbers.co/chaingraph/art-138-spdx-sbom-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-138-spdx-sbom-validator.md
- MCP tool: validate_spdx_sbom (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- sbom (unknown, optional)

## Outputs

- format (string, optional)
- has_relationships (boolean, optional)
- package_count (integer, optional)
- packages_missing_version (array, optional)
- sbom_valid (boolean, optional)
- spdx_version (string, optional)

## Sample

```json
{
  "sbom": {
    "spdxVersion": "SPDX-2.3",
    "SPDXID": "SPDXRef-DOCUMENT",
    "packages": [
      {
        "name": "express",
        "versionInfo": "4.18.2",
        "downloadLocation": "https://registry.npmjs.org/express/-/express-4.18.2.tgz"
      }
    ],
    "relationships": [
      {
        "spdxElementId": "SPDXRef-DOCUMENT",
        "relationshipType": "DESCRIBES",
        "relatedSpdxElement": "SPDXRef-Package-express"
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_spdx_sbom` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
