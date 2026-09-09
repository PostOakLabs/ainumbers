# Check MiCA Reserve Disclosure

Checks a token issuer's published reserve disclosure, the amount in circulation and the value and composition of the reserve, against the composition, concentration, segregation and publication-cadence terms the reader supplies. Deterministic and backward-looking: it reads what was published and compares it to declared rules, and contains no simulation of any kind. Coverage is the reserve total against tokens in circulation, with the surplus or shortfall. Composition tests each component against the caller's declared eligible asset classes and per-class concentration limits, listing every component that falls outside and keeping its amount inside the reserve total, because excluding it would flatter the coverage figure. Segregation tests the segregated proportion against the declared minimum, and lists every component whose custodian type the caller did not declare acceptable. Cadence names each period that ran longer than the declared interval with no publication, individually and with its dates, never as a count. HARD FENCE: the eligible asset classes, concentration limits, minimum segregated percentage, acceptable custodian types and disclosure cadence are every one of them a caller input, pinned in the artifact and shown on screen. This kernel ships no reporting template, no eligible-asset table and no issuer library, performs no lookups of any kind (zero-egress), and makes no claim about what the current rules are, so a rule change makes an old receipt dated rather than wrong. The one regime constant is the e-money-token minimum of 30 percent, applied only when the caller declared nothing, labelled at source in the receipt; for an asset-referenced token an absent minimum raises judgment_required naming the field rather than inventing a threshold. Every verdict is against the caller's declared rules: this is not a determination that the issuer complies, not legal advice, and not a submission. Where a named human attests the check, the dual-control certification surface art-503-build-dual-control-certification is reused and no second threshold evaluator is built. Distinct from rca-02-mica-reserve-stress, which is a Monte Carlo redemption stress asking whether the reserve survives a run, a forward-looking simulation this node neither imports nor edits, and from art-105-mica-token-service-scoper and tools/332-mica-casp-authorization-checker, neither of which reads a reserve disclosure. Out of scope: redemption stress simulation, authorisation and service scoping, white-paper conformance, template validation, any statement that an issuer is or is not compliant, and any coverage ratio about our own estate.

- Page: https://ainumbers.co/chaingraph/art-512-check-mica-reserve-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-512-check-mica-reserve-disclosure.md
- MCP tool: check_mica_reserve_disclosure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, optional)
- declared_rules (unknown, required)
- disclosure_dates (array, required)
- disclosure_ref (unknown, optional)
- issuer_id (unknown, optional)
- reserve_components (array, required)
- rounding (unknown, required)
- rules_version (unknown, optional)
- token_type (string, optional)
- tokens_in_circulation (unknown, required)
- window_end (unknown, required)
- window_start (unknown, required)

## Outputs

- as_of (string, optional)
- cadence (object, optional)
- composition (object, optional)
- coverage (object, optional)
- disclosure_ref (string, optional)
- fence (string, optional)
- issuer_id (string, optional)
- judgment_required (string, optional)
- not_proven (array, optional)
- rationale (array, optional)
- rounding (object, optional)
- rules_version (string, optional)
- segregation (object, optional)
- sign_off (object, optional)
- token_type (string, optional)

## Sample

```json
{
  "issuer_id": "ISSUER-DEMO-01",
  "disclosure_ref": "RESERVE-DISCLOSURE-2026-06",
  "rules_version": "reader-rules-1.0",
  "as_of": "2026-06-30",
  "token_type": "EMT",
  "tokens_in_circulation": "500000000",
  "reserve_components": [
    {
      "component_id": "C1",
      "asset_class": "bank_deposit",
      "amount": "205000000",
      "custodian_type": "credit_institution",
      "segregated": true
    },
    {
      "component_id": "C2",
      "asset_class": "sovereign_bill",
      "amount": "200000000",
      "custodian_type": "credit_institution",
      "segregated": false
    },
    {
      "component_id": "C3",
      "asset_class": "reverse_repo",
      "amount": "107500000",
      "custodian_type": "investment_firm",
      "segregated": false
    }
  ],
  "declared_rules": {
    "eligible_asset_classes": [
      "bank_deposit",
      "sovereign_bill",
      "reverse_repo"
    ],
    "concentration_limits": {
      "bank_deposit": "60",
      "sovereign_bill": "60",
      "reverse_repo": "30"
    },
    "acceptable_custodian_types": [
      "credit_institution",
      "investment_firm",
      "casp"
    ],
    "cadence_days": 31
  },
  "disclosure_dates": [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
    "2026-04-30",
    "2026-05-31",
    "2026-06-30"
  ],
  "window_start": "2026-01-01",
  "window_end": "2026-06-30",
  "rounding": {
    "decimal_places": 2,
    "mode": "half_up"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_mica_reserve_disclosure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
