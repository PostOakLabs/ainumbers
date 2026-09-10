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
