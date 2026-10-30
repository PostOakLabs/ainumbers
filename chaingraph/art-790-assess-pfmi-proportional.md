# PFMI proportional self-assessment scorer

Scores a payment system operator’s or overseer’s self-assessment against the 24 CPMI-IOSCO Principles (Apr 2012) or the 5 responsibilities of relevant authorities, on the methodology’s four-level scale plus not_applicable (Dec 2012), with this tool’s illustrative proportional tiers (systemic, prominent, small), a gap register, a date-ordered action plan, and an optional linked fast payment system governance module (CPMI Oct 2024 §4). Values only; never evidence.

- Page: https://ainumbers.co/chaingraph/art-790-assess-pfmi-proportional.html
- Markdown twin: https://ainumbers.co/chaingraph/art-790-assess-pfmi-proportional.md
- MCP tool: assess_pfmi_proportional (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- role (string, required)
- tier (string, optional)
- system_type (string, optional)
- linked_system (boolean, optional)
- ratings (array, required)

## Outputs

- principles_in_scope (array, optional)
- rated_count (number, optional)
- gap_register (array, optional)
- action_plan (array, optional)
- summary_by_rating (object, optional)
- coverage_pct (number, optional)
- tier_note (string, optional)

## Sample

```json
{
  "role": "operator",
  "tier": "small",
  "system_type": "payment_system",
  "linked_system": false,
  "ratings": [
    {
      "id": "p01",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p01"
    },
    {
      "id": "p02",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p02"
    },
    {
      "id": "p03",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p03"
    },
    {
      "id": "p04",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p04"
    },
    {
      "id": "p05",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p05"
    },
    {
      "id": "p07",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p07"
    },
    {
      "id": "p08",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p08"
    },
    {
      "id": "p09",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p09"
    },
    {
      "id": "p13",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p13"
    },
    {
      "id": "p15",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p15"
    },
    {
      "id": "p16",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p16"
    },
    {
      "id": "p17",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p17"
    },
    {
      "id": "p18",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p18"
    },
    {
      "id": "p19",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p19"
    },
    {
      "id": "p20",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p20"
    },
    {
      "id": "p21",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p21"
    },
    {
      "id": "p22",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p22"
    },
    {
      "id": "p23",
      "rating": "observed",
      "evidence_ref": "synthetic self-assessment workbook row p23"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_pfmi_proportional` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
