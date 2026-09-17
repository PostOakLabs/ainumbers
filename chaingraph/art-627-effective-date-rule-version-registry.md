# Effective-Date / Rule-Version Registry

Resolves which version of an accounting standard binds a given filer, entirely offline and client-side. The query is a triple: fiscal_year_end as an ISO date, never a month/day pair, because 52/53-week filers exist and their year-ends move; filer_status from a closed seven-value enum; and a standard identifier. It returns the binding annual and interim period-beginning dates, the early-adoption flag, first_binding_period_end, the transition method, and the rule parameters in force, where a parameter is always a value with its own effective_from, effective_to, source and source digest, and never a bare number. The registry itself is inert data delivered in policy_parameters and is never baked into kernel bytes, so adding a rule entry can never move the kernel digest or stale a receipt. The kernel recomputes the slice digest from the slice's own bytes and refuses to resolve on a mismatch, bounded at max_slice_entries of 32 so the in-guest hash stays measurable. Resolution is total: every triple in the declared domain returns exactly one entry or an explicit NO_BINDING_ENTRY, never a silent undefined, and no two parameter versions may hold overlapping effective windows. Ships with two demonstrator standards, FASB ASU 2023-07 on reportable segment disclosures and ASU 2023-09 on income tax disclosures, whose dates and thresholds are pinned to retrieved primary text.

- Page: https://ainumbers.co/chaingraph/art-627-effective-date-rule-version-registry.html
- Markdown twin: https://ainumbers.co/chaingraph/art-627-effective-date-rule-version-registry.md
- MCP tool: resolve_rule_version (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- query (object, optional)
- registry_slice (object, optional)

## Outputs

- resolution_status (string,null, optional)
- error_code (string,null, optional)
- message (string,null, optional)
- standard_id (string,null, optional)
- filer_status (string,null, optional)
- fiscal_year_end (string,null, optional)
- fiscal_year_begin (string,null, optional)
- fiscal_year_begin_basis (string,null, optional)
- effective_for_annual_periods_beginning (string,null, optional)
- effective_for_interim_periods_beginning (string,null, optional)
- early_adoption_permitted (boolean,null, optional)
- binding_for_queried_annual_period (boolean,null, optional)
- binding_for_queried_interim_periods (boolean,null, optional)
- first_binding_period_end (string,null, optional)
- transition_method (string,null, optional)
- parameter_set (object,null, optional)
- parameter_set_as_of (string,null, optional)
- entry_digest (string,null, optional)
- citation (object,null, optional)
- registry_digest_recomputed (string,null, optional)
- resolution_path (array, optional)
- bounds (object, optional)
- closed_filer_status_enum (array, optional)
- float_sensitive (boolean, optional)
- scope_note (string, optional)

## Sample

```json
{
  "query": {
    "fiscal_year_end": "2024-12-31",
    "filer_status": "large_accelerated",
    "standard_id": "ASU-2023-07"
  },
  "registry_slice": {
    "entries": [
      {
        "standard_id": "ASU-2023-07",
        "applies_to_filer_statuses": [
          "large_accelerated",
          "accelerated",
          "non_accelerated",
          "smaller_reporting",
          "emerging_growth"
        ],
        "scope_note": "The amendments apply to all public entities required to report segment information under Topic 280. The five filer statuses above are the public-entity members of the closed enum; private and non_public_business_entity are deliberately ABSENT, so a query for either resolves to an explicit NO_BINDING_ENTRY rather than a fabricated date.",
        "effective_for_annual_periods_beginning": "2023-12-16",
        "effective_for_interim_periods_beginning": "2024-12-16",
        "early_adoption_permitted": true,
        "transition_method": "retrospective",
        "date_derivation_note": "The source says \"fiscal years beginning after December 15, 2023\" and \"interim periods within fiscal years beginning after December 15, 2024\". \"After December 15\" is rendered as the first day on or after which a period beginning qualifies, i.e. 2023-12-16 and 2024-12-16, so the kernel's inclusive >= comparison reproduces the source's exclusive \"after\" exactly.",
        "parameter_set": {
          "segment_disclosure_scope": [
            {
              "value": "annual_only",
              "effective_from": "2023-12-16",
              "effective_to": "2024-12-16",
              "source": "ASU 2023-07, Summary, When Will the Amendments Be Effective and What Are the Transition Requirements? -- effective for fiscal years beginning after December 15, 2023, with interim periods only for fiscal years beginning after December 15, 2024.",
              "source_digest": "sha256:a999642aced1ae446b09ed5a481dce13d74f6670995be8e9339e754939c74dd8",
              "snapshot_location": "research/clause-snapshots/ASU-2023-07-effective-date.excerpt.txt"
            },
            {
              "value": "annual_and_interim",
              "effective_from": "2024-12-16",
              "effective_to": null,
              "source": "ASU 2023-07, Summary, When Will the Amendments Be Effective and What Are the Transition Requirements? -- interim periods within fiscal years beginning after December 15, 2024.",
              "source_digest": "sha256:a999642aced1ae446b09ed5a481dce13d74f6670995be8e9339e754939c74dd8",
              "snapshot_location": "research/clause-snapshots/ASU-2023-07-effective-date.excerpt.txt"
            }
          ],
          "entity_scope": [
            {
              "value": "public_entities_reporting_under_topic_280",
              "effective_from": "2023-12-16",
              "effective_to": null,
              "source": "ASU 2023-07, Summary, Who Is Affected by the Amendments in This Update? -- the amendments apply to all public entities that are required to report segment information in accordance with Topic 280, Segment Reporting.",
              "source_digest": "sha256:f401f66dffdd21e008a8e388ea6461475430311df60a70f88b7fa2de5826fcc6",
              "snapshot_location": "research/clause-snapshots/ASU-2023-07-scope.excerpt.txt"
            }
          ]
        },
        "citation": {
          "clause": "ASU 2023-07, Summary, When Will the Amendments Be Effective and What Are the Transition Requirements?",
          "source": "FASB Accounting Standards Update No. 2023-07, Segment Reporting (Topic 280): Improvements to Reportable Segment Disclosures (November 2023)",
          "source_digest": "sha256:a999642aced1ae446b09ed5a481dce13d74f6670995be8e9339e754939c74dd8",
          "snapshot_location": "research/clause-snapshots/ASU-2023-07-effective-date.excerpt.txt"
        }
      }
    ],
    "registry_digest": "528bd806c4fd75171915654577a20fff27d43d039ca6357e7d0380ad9b7459dd"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `resolve_rule_version` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
