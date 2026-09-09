# GloBE Article 9.1 Transition Deferred Tax Tracker

Recomputes the OECD GloBE Article 9.1 transition recast for a jurisdiction, item by item, over a bounded array of caller-declared deferred tax attributes, and reports the jurisdictional roll-forward total. Article 9.1.1 takes attributes into account at the lower of the Minimum Rate or the applicable domestic tax rate. That lower-of rule operates as a cap rather than an upward re-measurement, so an attribute already recorded at or below it is left where it is; the guidance worked example states the same outcome from the other side, and reading it as an unconditional re-measurement would leave Article 9.1.1's third sentence nothing to do. That third sentence is the single path on which a recast rises above the recorded figure: a deferred tax asset recorded below the Minimum Rate may be taken at the Minimum Rate where the taxpayer demonstrates it is attributable to a GloBE Loss, so the node treats the demonstration as a caller declaration and falls back to the general cap when it is absent. The impact of a valuation or accounting recognition adjustment is disregarded, which requires the gross figure from the caller. Article 9.1.2 exclusions apply only where a declared limb holds and, on the date keyed limbs, the attribute arose strictly after the cut off, so an attribute arising on the cut off day itself is not excluded; each exclusion is reported with a named code and contributes exactly zero, never merely dropped from the report. Article 9.1.3 recasts an intra group transfer falling after the cut off and before the Transition Year on the disposing entity's carrying value. The Minimum Rate, the cut off date, the Transition Year start and the enabled exclusion set all arrive as versioned policy parameters, so a guidance change is a parameter version bump and never moves the kernel digest. The item array is bounded by a declared kernel constant and an over length input is a named error rather than a longer loop. Items are reported and summed in a declared total order keyed on arising date, attribute type, carrying amount and input index, so the total never depends on the order the caller supplied, and it equals the sum of the reported per item recasts at the declared precision. Verify only: this node does not characterize an attribute, does not decide whether an arrangement is governmental, does not decide whether a GloBE Loss demonstration succeeds, and does not compute the Grace Period or Grace Period Limitation, which govern deferred tax expense on reversal under a separate computation. Where a characterization is absent, or a recast cannot be justified from a declared parameter, the item carries a manual review flag or a named error code instead of a silently computed number.

- Page: https://ainumbers.co/chaingraph/art-636-globe-transition-deferred-tax-tracker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-636-globe-transition-deferred-tax-tracker.md
- MCP tool: track_globe_transition_deferred_tax (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- constants_version (string, optional)
- minimum_rate (number, required)
- cutoff_date (string, required)
- transition_year_start_date (string, optional)
- exclusion_rules (array, required)
- items (array, required)

## Outputs

- constants_version (string,null, optional)
- minimum_rate (number,null, optional)
- cutoff_date (string,null, optional)
- transition_year_start_date (string,null, optional)
- exclusion_rules (array, optional)
- canonical_order (string, optional)
- items (array,null, optional)
- item_count (number, optional)
- items_excluded (number, optional)
- items_capped (number, optional)
- items_uplifted (number, optional)
- items_in_error (number, optional)
- items_manual_review (number, optional)
- jurisdictional_roll_forward_total (number,null, optional)
- total_is_complete (boolean, optional)
- error_code (string,null, optional)
- note (string, optional)
- rounding_steps (array, optional)

## Sample

```json
{
  "constants_version": "OECD-GloBE-MR-2021-12+AG-Art9.1-2025-01",
  "minimum_rate": 0.15,
  "cutoff_date": "2021-11-30",
  "transition_year_start_date": "2024-01-01",
  "exclusion_rules": [
    "EXCL_NOT_REFLECTABLE_UNDER_AFAS",
    "EXCL_CH3_ITEM_POST_CUTOFF",
    "EXCL_GOVERNMENTAL_ARRANGEMENT_POST_CUTOFF",
    "EXCL_RETROACTIVE_ELECTION_POST_CUTOFF",
    "EXCL_NEW_CIT_BASIS_STEP_UP_POST_CUTOFF"
  ],
  "items": [
    {
      "arises_from_chapter3_excluded_item": false,
      "arises_from_governmental_arrangement": false,
      "arises_from_retroactive_election": false,
      "arises_from_new_cit_basis_step_up": false,
      "reflectable_under_authorised_accounting_standard": true,
      "arises_from_intra_group_transfer": false,
      "attribute_type": "deferred_tax_asset",
      "carrying_amount": 1000,
      "recorded_at_rate": 0.15,
      "domestic_tax_rate": 0.15,
      "arising_date": "2023-06-30"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `track_globe_transition_deferred_tax` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
