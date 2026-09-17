# ViDA Platform and Registration

Classify a digital platform as a ViDA deemed supplier under Art. 46a: short-term accommodation (≤30 nights) or intra-EU road transport where underlying supplier has no valid VAT ID (art-162) -> route to correct ViDA Single VAT Registration scheme: Union OSS, Non-Union OSS, IOSS, or Domestic VAT (art-163) -> scored ViDA readiness diagnostic with 2028/2030/2035 phased obligation timeline (art-164). EU 2025/516, platform rule mandatory 2028-07-01.

- Page: https://ainumbers.co/chaingraph/chains/vida-platform-and-registration.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/vida-platform-and-registration.md

## Workflow chain: ViDA Platform and Registration

Classify a digital platform as a ViDA deemed supplier under Art. 46a: short-term accommodation (≤30 nights) or intra-EU road transport where underlying supplier has no valid VAT ID (art-162) -> route to correct ViDA Single VAT Registration scheme: Union OSS, Non-Union OSS, IOSS, or Domestic VAT (art-163) -> scored ViDA readiness diagnostic with 2028/2030/2035 phased obligation timeline (art-164). EU 2025/516, platform rule mandatory 2028-07-01.

Domain: ViDA / E-Invoicing

### Steps

1. art-162-vida-platform-deemed-supplier-classifier
   Deemed supplier verdict feeds OSS registration router
2. art-163-vida-oss-registration-router
   OSS scheme recommendation feeds readiness diagnostic
3. art-164-vida-compliance-readiness-diagnostic
   Exports scored ViDA readiness position with phased obligation timeline with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
