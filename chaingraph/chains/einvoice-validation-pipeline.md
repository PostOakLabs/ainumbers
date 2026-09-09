# E-Invoice Validation Pipeline

Gated four-step e-invoice validation pipeline: format conformance check (Factur-X, XRechnung, PINT-AE, MyInvois, Peppol BIS 3.0/Belgium, KSeF FA(3)/Poland), VAT arithmetic verification, jurisdiction mandate routing, and a hash-anchored transmission receipt carrying the SPEC.md §27 pre-transmission release gate (review_required, schema-only pending HA-RETRO-1). Exits early on a format-conformance failure or a VAT-arithmetic mismatch, so the receipt is only ever built for a document that passed both checks.

- Page: https://ainumbers.co/chaingraph/chains/einvoice-validation-pipeline.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/einvoice-validation-pipeline.md

## Workflow chain: E-Invoice Validation Pipeline

Gated four-step e-invoice validation pipeline: format conformance check (Factur-X, XRechnung, PINT-AE, MyInvois, Peppol BIS 3.0/Belgium, KSeF FA(3)/Poland), VAT arithmetic verification, jurisdiction mandate routing, and a hash-anchored transmission receipt carrying the SPEC.md §27 pre-transmission release gate (review_required, schema-only pending HA-RETRO-1). Exits early on a format-conformance failure or a VAT-arithmetic mismatch, so the receipt is only ever built for a document that passed both checks.

Domain: ViDA / E-Invoicing

### Steps

1. art-293-einvoice-format-validator
   structural_completeness feeds Stage 2 VAT verification; a format failure stops the chain
2. art-294-einvoice-vat-calc-verifier
   consistent feeds Stage 3 mandate routing; a VAT-arithmetic mismatch stops the chain
3. art-295-einvoice-jurisdiction-mandate-router
   routed_mandate feeds the terminal transmission receipt
4. art-296-einvoice-transmission-receipt-builder
   Composes the hash-anchored transmission receipt - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
