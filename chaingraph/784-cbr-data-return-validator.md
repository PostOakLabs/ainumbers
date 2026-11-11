# CBR Data Return Validator

Validates a bank's or money transfer operator's periodic AGGREGATE correspondent-banking data return against an illustrative, profile-driven template (generic first, Pacific second) so an institution can check completeness, internal consistency and comparability locally before submission. Inputs are counts, sums, currency codes, ISO country codes, period dates and enumerated institution types only: per key currency the active correspondent count with relationships opened and terminated or restricted, and outbound and inbound counts and values by corridor country, plus optional message-quality summaries (structure mix and valid-LEI counts) taken from lint_cbpr_structured_address (art-241) and lint_lei_payment_binding (art-246) outputs. Rules: required fields per profile (the Pacific profile requires USD, AUD and NZD present), correspondent roll-forward (closing equals opening plus opened minus terminated), corridor sums against stated currency totals (counts exact, values within a stated 0.5 percent tolerance), period sanity, code membership, single-correspondent key-currency watch, and concentration (top corridor share and a Herfindahl-Hirschman index over corridor shares). Output is verdict, violations by JSON path with rule ids, computed flags, a readiness roll-up band (or not_supplied), the profile and template version - it never echoes a free-text value. The template is ILLUSTRATIVE: it is not the official Pacific CBR project data collection template (still being finalised by that programme) and not the World Bank CBR Resilience Index (calibration pending). Declared exclusions: aggregate-only - any string leaf outside the enumerations and the FI-NNN pseudonymous institution code pattern (no names, BIC, LEI or account identifiers in the return itself) is refused by path with the value never echoed; per-message ISO 20022 linting is out of scope (use art-241 and art-246). Swift's CBPR+ structured-address change was deferred on 27 Aug 2026 with an update promised by December 2026 at the latest, so no hard migration date is asserted anywhere; readiness prose anchors on the FATF revised Recommendation 16 (June 2025) payment-transparency direction with its end-2030 transition.

- Page: https://ainumbers.co/chaingraph/784-cbr-data-return-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/784-cbr-data-return-validator.md
- MCP tool: validate_cbr_data_return (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, required)
- institution_type (string, required)
- institution_code (string, required)
- period (object, required)
- currencies (array, required)
- message_quality (object, optional)

## Outputs

- valid (boolean, optional)
- refused (object,null, optional)
- violations (array, optional)
- flags (array, optional)
- readiness (object, optional)
- rules_checked (array, optional)
- profile (string,null, optional)
- template_version (string, optional)
- profile_definition (object, optional)
- computed (object, optional)
- pii_note (string, optional)
- disambiguation (string, optional)

## Sample

```json
{
  "profile": "generic",
  "institution_type": "bank",
  "institution_code": "FI-001",
  "period": {
    "start": "2026-01-01",
    "end": "2026-03-31"
  },
  "currencies": [
    {
      "currency": "USD",
      "opening_correspondents": 5,
      "active_correspondents": 4,
      "opened": 1,
      "terminated_restricted": 2,
      "corridors": [
        {
          "country": "US",
          "outbound_count": 1200,
          "inbound_count": 900,
          "outbound_value": 6000000,
          "inbound_value": 4400000
        },
        {
          "country": "GB",
          "outbound_count": 900,
          "inbound_count": 700,
          "outbound_value": 5000000,
          "inbound_value": 3600000
        },
        {
          "country": "SG",
          "outbound_count": 600,
          "inbound_count": 500,
          "outbound_value": 4000000,
          "inbound_value": 2900000
        }
      ],
      "totals": {
        "outbound_count": 2700,
        "inbound_count": 2100,
        "outbound_value": 15000000,
        "inbound_value": 10900000
      }
    },
    {
      "currency": "EUR",
      "opening_correspondents": 3,
      "active_correspondents": 3,
      "opened": 0,
      "terminated_restricted": 0,
      "corridors": [
        {
          "country": "DE",
          "outbound_count": 400,
          "inbound_count": 300,
          "outbound_value": 1500000,
          "inbound_value": 1200000
        },
        {
          "country": "FR",
          "outbound_count": 300,
          "inbound_count": 250,
          "outbound_value": 1000000,
          "inbound_value": 900000
        },
        {
          "country": "NL",
          "outbound_count": 150,
          "inbound_count": 120,
          "outbound_value": 700000,
          "inbound_value": 600000
        }
      ],
      "totals": {
        "outbound_count": 850,
        "inbound_count": 670,
        "outbound_value": 3200000,
        "inbound_value": 2700000
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_cbr_data_return` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
