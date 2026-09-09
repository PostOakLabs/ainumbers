# CRA Annex I Completeness Checker

Checks EU CRA Annex I Part I essential cybersecurity requirements: sbom_present, sbom_machine_readable, top_level_deps_covered, vuln_handling_policy_present, secure_by_default, and a valid conformity_route (self_assessment | eu_type_examination | full_quality_assurance). Emits annex1_complete verdict and ordered gap list with PDF export. Middle stage of cra-product-conformance chain.

- Page: https://ainumbers.co/chaingraph/art-139-cra-annex1-completeness-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-139-cra-annex1-completeness-checker.md
- MCP tool: check_cra_annex1_completeness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- conformity_route (unknown, optional)
- sbom_machine_readable (unknown, optional)
- sbom_present (unknown, optional)
- secure_by_default (unknown, optional)
- top_level_deps_covered (unknown, optional)
- vuln_handling_policy_present (unknown, optional)

## Outputs

- annex1_complete (boolean, optional)
- conformity_route (string, optional)
- gaps (array, optional)

## Sample

```json
{
  "sbom_present": true,
  "sbom_machine_readable": true,
  "top_level_deps_covered": true,
  "vuln_handling_policy_present": true,
  "secure_by_default": true,
  "conformity_route": "self_assessment"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_cra_annex1_completeness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
