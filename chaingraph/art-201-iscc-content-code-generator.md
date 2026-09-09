# ISCC Content Code Generator

Generates ISO 24138 ISCC content fingerprints for digital content. Computes Instance-Code (BLAKE3 data integrity), Data-Code (CDC + minhash similarity), optional Meta-Code (simhash over title n-grams from the supplied title), and a composite ISCC-CODE when at least one unit is available. Pure-JS implementation matching the iscc-core conformance vectors. TEXT and METADATA scope only.

- Page: https://ainumbers.co/chaingraph/art-201-iscc-content-code-generator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-201-iscc-content-code-generator.md
- MCP tool: generate_iscc_code (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- content (unknown, required)
- creator (unknown, required)
- title (unknown, required)

## Outputs

- conformance_pass (boolean, optional)
- data_code (string, optional)
- datahash (string, optional)
- input_bytes (integer, optional)
- instance_code (string, optional)
- iscc_code (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `generate_iscc_code` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
