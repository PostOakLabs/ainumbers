# FIDA Open Finance Readiness

FIDA scope classification > data-scope mapping > FIP authorisation readiness > permission-scheme scoping > cross-sector data scope: composite FIDA readiness mandate.

- Page: https://ainumbers.co/chaingraph/chains/fida-open-finance-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/fida-open-finance-readiness.md

## Workflow chain: FIDA Open Finance Readiness

FIDA scope classification > data-scope mapping > FIP authorisation readiness > permission-scheme scoping > cross-sector data scope: composite FIDA readiness mandate.

Domain: Open Banking / Open Finance

### Steps

1. 273-fida-open-finance-readiness
   fida_scope and regulated_entities feed Stage 2 data-scope mapping
2. 360-fida-open-finance-data-scope-mapper
   data_scope_map feeds Stage 3 FIP authorisation readiness builder
3. 407-fida-fip-authorisation-readiness-builder
   fip_auth_gaps and timeline feed Stage 4 permission scheme checker
4. 408-fida-permission-scheme-scope-checker
   permission_scheme_scores feed Stage 5 cross-sector data scope mapper
5. 410-fida-cross-sector-data-scope-mapper
   cross_sector_scope and composite readiness score - final FIDA mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
