# GloBE Annual Filing Cycle

OECD Pillar Two GloBE annual cycle - jurisdictional ETR feeds the transitional safe harbour test; if safe harbour is met, top-up tax is deemed zero and SBIE/top-up computation is skipped (§21.4 conditional), otherwise SBIE and top-up tax are computed; the GIR composer then assembles the jurisdictional-summary GIR (OECD GIR XML, version-pinned, NOT-submittable) from whichever upstream artifacts ran. Election choices are recorded as §27.4 review_required; GIR release requires dual_control(2) (preparer + tax-officer); safe-harbour reliance is a separate reviewer approval record with reason_code. Evidence bundle per filing cycle (§27.6). Never a filed submission.

- Page: https://ainumbers.co/chaingraph/chains/globe-annual-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/globe-annual-cycle.md

## Workflow chain: GloBE Annual Filing Cycle

OECD Pillar Two GloBE annual cycle - jurisdictional ETR feeds the transitional safe harbour test; if safe harbour is met, top-up tax is deemed zero and SBIE/top-up computation is skipped (§21.4 conditional), otherwise SBIE and top-up tax are computed; the GIR composer then assembles the jurisdictional-summary GIR (OECD GIR XML, version-pinned, NOT-submittable) from whichever upstream artifacts ran. Election choices are recorded as §27.4 review_required; GIR release requires dual_control(2) (preparer + tax-officer); safe-harbour reliance is a separate reviewer approval record with reason_code. Evidence bundle per filing cycle (§27.6). Never a filed submission.

Domain: Bank Capital & Credit Risk

### Steps

1. art-454-globe-jurisdictional-etr
   Jurisdictional GloBE income/loss and covered taxes reduce to etr_by_jurisdiction; feeds the safe harbour test.
2. art-456-globe-safe-harbour-tests
   Evaluates de minimis / simplified ETR / routine profits tests against etr_by_jurisdiction. safe_harbour_flags gate the next stage (§21.4 conditional): if met, top-up tax is deemed zero and SBIE/top-up is skipped; if not met, SBIE/top-up runs. Safe-harbour reliance is a reviewer approval record with reason_code, not computed here.
3. art-455-globe-sbie-topup
   CONDITIONAL on art-456's safe_harbour_flags (§21.4) - runs only when safe harbour is not met for a jurisdiction. Computes SBIE (payroll + tangible-asset carve-outs, versioned transition-year rates) and top-up tax, producing topup_amounts and qdmtt_allocation for the GIR composer.
4. art-457-globe-gir-composer
   Assembles the OECD GloBE Information Return jurisdictional-summary shape from art-454/455/456 outputs (deemed-zero top-up where safe harbour was met): OECD GIR XML (schema version pinned) + form-shaped JSON, both NOT-submittable. Election choices review_required; GIR release dual_control(2) preparer + tax-officer; evidence bundle per filing cycle - final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
