# Reg Z Threshold Lookup

Reg Z version-pinned threshold lookup service. Tables: qm_points_fees, hoepa, hpml, card_penalty. 2021-2026 rows with Federal Register citations and effective dates. This node exists because agents reliably hallucinate current-year dollar thresholds. Annual refresh cadence with FR citation pinning. Covers CARD Act penalty fees under 12 CFR 1026.52(b)(1)(ii)(A)/(B) as one general safe harbor of $32 for a first violation and $43 for each subsequent violation of the same type, applying to late fees and other violations alike: the CFPB $8 late-fee cap (89 FR 19128) was enjoined 2024-05-10 before its 2024-05-14 effective date and vacated 2025-04-15 in Chamber of Commerce v. CFPB, No. 4:24-cv-00213-P (N.D. Tex.), so it is void and was never operative even though the eCFR still prints it. The hpml rows carry the 12 CFR 1026.35(c)(2)(ii) special-appraisal exemption, $34,200 for 2026 per FR 2025-22875, 90 FR 58141.

- Page: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html
- Markdown twin: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.md
- MCP tool: lookup_reg_z_thresholds (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- table (any, required): type not evidenced by kernel source
- year (number, optional)

## Outputs

- available_years (array, optional)
- data (object, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- table (string, optional)
- year (integer, optional)

## Sample

```json
{
  "year": 2026,
  "table": "qm_points_fees"
}
```

## Verify

Run the sample policy_parameters through MCP tool `lookup_reg_z_thresholds` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
