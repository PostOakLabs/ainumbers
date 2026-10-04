# Tokenization Prep

ISCC content fingerprint > AI-training rights reservation > royalty split validation > TASL attribution string > certified tokenization-ready license VC. The royalty-split step is optional and can be skipped if no on-chain split applies.

- Page: https://ainumbers.co/chaingraph/chains/tokenization-prep.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tokenization-prep.md

## Workflow chain: Tokenization Prep

ISCC content fingerprint > AI-training rights reservation > royalty split validation > TASL attribution string > certified tokenization-ready license VC. The royalty-split step is optional and can be skipped if no on-chain split applies.

Domain: Document & Content Provenance

### Steps

1. art-201-iscc-content-code-generator
   ISCC content fingerprint and datahash feed Stage 2 AI-training rights reservation
2. art-202-tdmrep-reservation-builder
   TDMRep JSON and Content-Usage header feed Stage 3 royalty split validation
3. art-208-royalty-split-validator
   Validated split config and config_hash feed Stage 4 attribution string generation (step is optional - proceed with empty input if no split applies)
4. art-207-attribution-string-generator
   TASL attribution string, ccREL JSON-LD, and RDFa block feed Stage 5 license election certification
5. art-199-license-election-certifier
   Exports certified tokenization-ready license VC with ISCC binding and execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We are preparing the catalog asset for tokenization. Which royalty split finding blocks a clean prep pack?
Run the AINumbers MCP tool `run_chain` with {"chain":"tokenization-prep"} and read `art-208-royalty-split-validator.valid`.
Re-run with `inputs` for `art-208-royalty-split-validator`, reusing the values that result echoed, with `cap_bps` changed so cap_bps set to 4000, keeping the two 5000 bps entries. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/tokenization-prep.html
