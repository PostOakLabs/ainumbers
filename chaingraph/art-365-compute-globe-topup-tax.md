# GloBE Top-Up Tax & QDMTT Allocation Calculator

OECD Pillar Two GloBE top-up tax calculator: per-jurisdiction substance-based income exclusion (SBIE), effective tax rate (ETR), and top-up-rate/top-up-amount, then allocates the top-up across QDMTT, IIR, and UTPR, applying the OECD Side-by-Side Safe Harbour (approved/declassified 5 January 2026) when the caller declares a Central Record listing of a Qualified SbS Regime, a Filing Constituent Entity election, and a fiscal year on or after 1 January 2026 - when it applies, Top-up Tax is deemed zero for both the IIR and the UTPR. Ports the calculation from tools/473-globe-etr-jurisdiction-calculator.html and tools/474-topup-tax-qdmtt-calculator.html into one provable kernel. SBIE payroll/asset rates and the 15% minimum rate are OECD-published transitional table values pinned behind a constants_version field - a rate change is a version bump, never a silent recompute. Jurisdiction-level QDMTT enactment/rate and the Central Record listing are caller-supplied, never vendored. KNOWN-WRONG (comment only, not behaviour, recorded 2026-08-17 per ART9-CITATION-FIX-1): the kernel source at chaingraph/kernels/art-365-compute-globe-topup-tax.kernel.mjs line 49 cites the SBIE transitional rates as 'Art. 9.1' - the correct citation is Art. 9.2 (Art. 9.1 is Tax Attributes Upon Transition; Art. 9.2 is the Transitional relief for the Substance-based Income Exclusion, per research/ART9-NUMBERING-CONFIRM-1.md and research/ART9-NUMBERING-DENY-1.md). This node is sealed (compute_proof_ready: ready) so the kernel comment is left uncorrected per SO #36 - no GPU re-prove for a comment. The kernel's behaviour is correct and cleared ART-365-SIDEBYSIDE-1 with zero divergences; fix the comment only if art-365 is ever legitimately re-proved for another reason.

- Page: https://ainumbers.co/chaingraph/art-365-compute-globe-topup-tax.html
- Markdown twin: https://ainumbers.co/chaingraph/art-365-compute-globe-topup-tax.md
- MCP tool: compute_globe_topup_tax (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- central_record_sbs (array, required)
- fy (number, required)
- jurisdictions (array, required)
- parent_hq (unknown, required)
- sbs_election (boolean, required)

## Outputs

- aggregate_etr (number, optional)
- central_record_sbs (array, optional)
- constants_version (string, optional)
- fy (integer, optional)
- globe_min_rate (number, optional)
- jurisdictions (array, optional)
- low_etr_count (integer, optional)
- note (string, optional)
- parent_hq (string, optional)
- regulatory_basis (string, optional)
- sbs_election (boolean, optional)
- total_iir_collected (number, optional)
- total_income (integer, optional)
- total_qdmtt_collected (number, optional)
- total_taxes (integer, optional)
- total_top_up_tax (number, optional)
- total_utpr_collected (integer, optional)
- us_exempt (boolean, optional)

## Sample

```json
{
  "parent_hq": "DE",
  "fy": 2026,
  "jurisdictions": [
    {
      "jur": "DE",
      "income": 500,
      "taxes": 70,
      "payroll": 200,
      "assets": 300,
      "sbie_payroll_rate": 0.094,
      "qdmtt_enacted": true,
      "qdmtt_rate": 0.15
    },
    {
      "jur": "IE",
      "income": 200,
      "taxes": 20,
      "payroll": 80,
      "assets": 100,
      "sbie_payroll_rate": 0.094,
      "qdmtt_enacted": true,
      "qdmtt_rate": 0.15
    },
    {
      "jur": "SG",
      "income": 150,
      "taxes": 18,
      "payroll": 60,
      "assets": 120,
      "sbie_payroll_rate": 0.094,
      "qdmtt_enacted": false,
      "qdmtt_rate": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_globe_topup_tax` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
