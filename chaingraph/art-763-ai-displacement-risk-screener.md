# AI Displacement Risk Screener

AI-driven job-displacement risk screener ported from ApexLogics Apex #104 (AL-111). For a task-composition profile (routine cognitive/manual and non-routine analytical/interpersonal/manual shares, 0..100 each), a sector exposure factor, an education level and years in role, the node computes a 0..100 composite displacement score as 0.40 x automation probability + 0.40 x routine-task fraction + 0.20 x sector exposure, clamped and rounded, with an education-adjusted informational score and a four-tier banding (Low <= 30, Medium <= 55, High <= 75, else Critical). Selecting a SOC code looks the occupation up in an embedded 62-row table (title, Frey-Osborne automation probability, task splits, BLS-OES-labelled median salary); leaving it null estimates the probability from the sliders (slope 0.85, floor 0.05, cap 0.99). The node also returns up to three adjacent lower-exposure occupations scored with the caller's sector factor, gated at similarity >= 60. Invalid-domain inputs are rejected by throw with a named reason. The automation probabilities are Frey-Osborne 2013-vintage estimates (stale by construction), the task splits are Apex-embedded approximations, and the median-salary cells labelled BLS OES 2025 stayed ungrounded at porting time (BLS HTTP 403): salary figures are informational only and stay out of the score, with every vintage and grounding flag carried in the kernel metadata (payload DIFFERS.md D1-D4, CITES.md U1-U4).

- Page: https://ainumbers.co/chaingraph/art-763-ai-displacement-risk-screener.html
- Markdown twin: https://ainumbers.co/chaingraph/art-763-ai-displacement-risk-screener.md
- MCP tool: ai_displacement_risk_screener (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- soc_code (string,null, optional): 6-digit SOC code key into the embedded 62-row table; null selects the custom-occupation estimate branch (Apex L480-488). The only optional input.
- rc (integer, required): Routine Cognitive share 0..100 (slider t_rc, Apex L470; parseInt read).
- rm (integer, required): Routine Manual share 0..100 (slider t_rm, Apex L471; parseInt read).
- nra (integer, required): Non-routine Analytical share 0..100 (slider t_nra, Apex L472; parseInt read).
- nri (integer, required): Non-routine Interpersonal share 0..100 (slider t_nri, Apex L473; parseInt read).
- nrm (integer, required): Non-routine Manual share 0..100 (slider t_nrm, Apex L474; parseInt read).
- sector_exp (number, required): Sector exposure factor (select sector, Apex L475; parseFloat read). Apex option values 0.22..0.75.
- ed_level (string, required): Highest education (select edLevel, Apex L476; informational education adjustment only, Apex L499-500).
- years_role (integer, required): Years in role (input yearsRole, Apex L477; parseInt read; recorded, not in the arithmetic).

## Outputs

- score (integer, optional)
- adj_score (integer, optional)
- tier (string, optional)
- prob (number, optional)
- routine_frac (number, optional)
- sector_exp (number, optional)
- automation_pct (integer, optional)
- routine_pct (integer, optional)
- sector_pct (integer, optional)
- title (string, optional)
- soc (string,null, optional)
- median_salary_usd (integer,null, optional)
- alts (array, optional)

## Sample

```json
{
  "soc_code": "15-1132",
  "rc": 15,
  "rm": 4,
  "nra": 60,
  "nri": 16,
  "nrm": 5,
  "sector_exp": 0.45,
  "ed_level": "bachelor",
  "years_role": 5
}
```

## Verify

Run the sample policy_parameters through MCP tool `ai_displacement_risk_screener` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
