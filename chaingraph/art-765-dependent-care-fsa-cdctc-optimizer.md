# Dependent Care FSA vs. CDCTC Optimizer

Compare a Dependent Care FSA (IRC section 129 exclusion) against the Child and Dependent Care Tax Credit (IRC section 21) plus the optimal combination, with FICA savings on the contribution. Three strategy cards, a $250-grid optimum sweep, and a full OCG v0.4 artifact. Refuses malformed inputs with named reasons; money is float USD exactly as the source computes it. Ported from ApexLogics Apex #130 (AL-137, CC BY 4.0), fetched 2026-10-13, sha256 fec17792. The kernel carries an explicit as_of whose tax year selects the statutory table: 2026+ applies Pub. L. 119-21 sections 70404/70405 ($7,500/$3,750 exclusion cap, 50%/35%/20% applicable-percentage schedule at $2,000/$4,000 steps), earlier years the prior text; a verification-only apex_page ruleset reproduces the source page value-for-value (inputSchema registration drops it; 88/88 payload vectors reproduce both rulesets at land). DIFFERS rows D1-D7 are resolved to the fetched statute with the MFS case kept as Apex arithmetic plus the ART765_CDCTC_MFS_BARRED_BY_SECTION_21E2 flag (grader caveat, open question left to Tim).

- Page: https://ainumbers.co/chaingraph/art-765-dependent-care-fsa-cdctc-optimizer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-765-dependent-care-fsa-cdctc-optimizer.md
- MCP tool: estimate_dc_fsa_cdctc_split (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (string, required): Tax date YYYY-MM-DD. The node reads no clock; its tax year picks the statutory table (2026+ = Pub. L. 119-21 70404/70405).
- filing_status (string, required): Filing status. 'mfj' picks the joint tier-B step; 'mfs' uses the $3,750 cap and carries the 21(e)(2) flag.
- agi (number, required): Household adjusted gross income in USD dollars, non-negative. Drives the section 21(a)(2) applicable percentage.
- marginal_rate_pct (number, required): Caller-supplied federal marginal rate in percent, 0..100. Not computed from tax tables.
- state_rate_pct (number, required): State income tax rate in percent, 0..100.
- num_children (integer, required): Number of qualifying individuals, at least 1. Two or more uses the $6,000 expense cap (IRC section 21(c)(2)) instead of $3,000.
- childcare_cost (number, required): Actual annual childcare expenses in USD dollars, non-negative.
- fsa_available (boolean, required): Is a dependent care FSA available through the employer? When false no sweep runs and the CDCTC-only strategy is the optimum.
- fsa_contrib (number, optional): Optional and echoed only, never used: the source page reads this control (page line 359) and the compute never dereferences it.

## Sample

```json
{
  "as_of": "2026-10-13",
  "filing_status": "mfj",
  "agi": 95000,
  "marginal_rate_pct": 22,
  "state_rate_pct": 5,
  "num_children": 2,
  "childcare_cost": 18000,
  "fsa_available": true,
  "fsa_contrib": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `estimate_dc_fsa_cdctc_split` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
