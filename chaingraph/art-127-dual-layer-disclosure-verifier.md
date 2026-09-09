# Dual-Layer Disclosure Verifier

Confirm the EU Commission Code of Practice multi-layer requirement: both C2PA signed metadata and an imperceptible watermark (SynthID / Digimarc / TrustMark / c2pa.soft_binding) are declared present. Fails if only one layer present. Emits layers-present and missing-layer.

- Page: https://ainumbers.co/chaingraph/art-127-dual-layer-disclosure-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-127-dual-layer-disclosure-verifier.md
- MCP tool: verify_dual_layer_disclosure (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "c2pa_metadata_present": true,
  "watermark_present": true,
  "watermark_method": "synthid"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_dual_layer_disclosure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
