# TRAIGA Safe Harbor Pack Builder

Assembles a supplied NIST AI RMF function-mapping result (map_nist_ai_rmf_functions) and TRAIGA exposure-assessment result into an affirmative-defense evidence bundle under Tex. Bus. & Com. Code §553.106: eligible only when the RMF coverage band is Substantial or Comprehensive AND no prohibited use was detected upstream. Framed as evidence toward the statutory affirmative defense, never a guarantee the defense succeeds - that determination belongs to a court or the Texas Attorney General. Terminal node of the traiga-safe-harbor chain. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-314-traiga-safe-harbor-pack-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-314-traiga-safe-harbor-pack-builder.md
- MCP tool: build_traiga_safe_harbor_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- exposure_result (unknown, required)
- rmf_mapping (unknown, required)

## Outputs

- coverage_band (string, optional)
- eligible_for_affirmative_defense_evidence (boolean, optional)
- framing (string, optional)
- insufficient_evidence (boolean, optional)
- meets_substantial_compliance_bar (boolean, optional)
- overall_coverage (string, optional)
- prohibited_use_detected (string, optional)
- statute_citation (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `build_traiga_safe_harbor_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
