# Pillar Two GloBE Minimum Tax

OECD Pillar Two GloBE end-to-end workflow: ETR per jurisdiction > top-up tax and QDMTT/IIR/UTPR allocation > safe harbour eligibility > GloBE Information Return (GIR).

- Page: https://ainumbers.co/chaingraph/chains/pillar-two-globe.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pillar-two-globe.md

## Workflow chain: Pillar Two GloBE Minimum Tax

OECD Pillar Two GloBE end-to-end workflow: ETR per jurisdiction > top-up tax and QDMTT/IIR/UTPR allocation > safe harbour eligibility > GloBE Information Return (GIR).

Domain: Bank Capital & Credit Risk

### Steps

1. 473-globe-etr-jurisdiction-calculator
   etr_by_jur and sbie_amounts feed Stage 2 top-up tax calc
2. 474-topup-tax-qdmtt-calculator
   topup_amounts and qdmtt_allocation feed Stage 3 safe harbour check
3. 475-pillar-two-safe-harbour-checker
   safe_harbour_flags feed Stage 4 GIR Builder
4. 476-gir-builder
   Exports composite Pillar Two GloBE Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
