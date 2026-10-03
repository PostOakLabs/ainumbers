# AI Content Disclosure Conformance (EU AI Act Art. 50)

Check Art. 50(2) IPTC digitalSourceType marking adequacy and deepfake disclosure (art-126) then verify both C2PA metadata and imperceptible watermark dual-layer are present per Code of Practice (art-127) then validate hard-binding vs soft-binding consistency and confirm asset byte-hash matches (art-128). Applies 2 Aug 2026.

- Page: https://ainumbers.co/chaingraph/chains/ai-content-disclosure-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-content-disclosure-conformance.md

## Workflow chain: AI Content Disclosure Conformance (EU AI Act Art. 50)

Check Art. 50(2) IPTC digitalSourceType marking adequacy and deepfake disclosure (art-126) then verify both C2PA metadata and imperceptible watermark dual-layer are present per Code of Practice (art-127) then validate hard-binding vs soft-binding consistency and confirm asset byte-hash matches (art-128). Applies 2 Aug 2026.

Domain: AI & Agent Governance

### Steps

1. art-126-ai-act-art50-marking-checker
   Art. 50 marking verdict feeds dual-layer verification
2. art-127-dual-layer-disclosure-verifier
   dual-layer verdict feeds binding assertion validation
3. art-128-content-binding-assertion-validator
   Exports binding verdict with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The images we ship carry a watermark and signed metadata. If a pixel changes, does the content binding flag it?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-content-disclosure-conformance"} and read `art-128-content-binding-assertion-validator.verdict`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-content-disclosure-conformance.html
