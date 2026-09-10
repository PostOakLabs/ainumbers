# CARF / DAC8 Reportable User Classifier

Classifies crypto-asset user records and their transactions for Crypto-Asset Reporting Framework and DAC8 purposes, against a policy set the caller declares rather than one this node asserts: which residence jurisdictions the reporting jurisdiction treats as reportable, which transaction classes are in scope, the due-diligence rule set keyed by the caller's own rule codes, and the pinned schema version. Nothing about any jurisdiction's transposition is in kernel source, so the node states no view on how a jurisdiction has implemented CARF or DAC8. A deactivation list is a first-class input: a suppressed rule code produces no unsatisfied due-diligence step at all for any record, and every suppression applied is echoed with a count so the exclusion is visible rather than silent. Self-certification is the gating step. Anything other than a valid self-certification leaves reportability undetermined rather than guessed, and an undetermined verdict is never a bare flag: each carries an entry naming what is undetermined, which input would resolve it, and the role that decides. Entity records fold controlling-person residences into the determination, so an entity outside the reportable set whose controlling person is inside it is caught. Transactions are classified only once the user is classifiable. Output is counts by verdict and by transaction class, never a ratio and never a percentage. Zero personal data by construction: users are identified by an opaque caller-supplied reference, and the node takes no name, no tax identification number, no address and no date of birth. No clock is read, so the reporting period is a declared input and nothing silently expires. Stated boundary: this classifies only. It computes no tax liability, it submits and transmits nothing, it makes no claim that its output is submittable, and it is not legal or tax advice.

- Page: https://ainumbers.co/chaingraph/art-504-classify-carf-reportable.html
- Markdown twin: https://ainumbers.co/chaingraph/art-504-classify-carf-reportable.md
- MCP tool: classify_carf_reportable (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- due_diligence_rules (array, required)
- judgment_owner_role (unknown, required)
- records (array, required)
- reportable_residence_jurisdictions (unknown, required)
- reportable_transaction_classes (unknown, required)
- reporting_jurisdiction (unknown, required)
- reporting_period (unknown, required)
- schema_version (unknown, required)
- suppressed_rule_codes (unknown, required)

## Outputs

- judgment_required (array, optional)
- judgment_required_count (integer, optional)
- note (string, optional)
- record_count (integer, optional)
- record_verdicts (array, optional)
- reportable_residence_jurisdictions (array, optional)
- reportable_transaction_classes (array, optional)
- reporting_jurisdiction (string, optional)
- reporting_period (string, optional)
- schema_version (string, optional)
- suppressed_rule_codes (array, optional)
- suppressed_step_count (integer, optional)
- transaction_counts_by_class (object, optional)
- unsatisfied_step_count (integer, optional)
- user_counts (object, optional)

## Sample

```json
{
  "reporting_jurisdiction": "IE",
  "schema_version": "OECD-CARF-XML-SCHEMA-JULY-2025",
  "reporting_period": "2026",
  "judgment_owner_role": "named tax compliance officer of the Reporting Crypto-Asset Service Provider",
  "reportable_residence_jurisdictions": [
    "DE",
    "FR",
    "IE"
  ],
  "reportable_transaction_classes": [
    "crypto_to_fiat_exchange",
    "crypto_to_crypto_exchange",
    "retail_payment_above_threshold",
    "transfer"
  ],
  "due_diligence_rules": [
    {
      "rule_code": "BR-CARF-WALLETADDR-001",
      "step": "wallet address capture",
      "applies_to": "all",
      "required_field": "wallet_address_ref",
      "description": "A wallet address reference is required on every reportable user record (BR-CARF-WALLETADDR-001)."
    }
  ],
  "suppressed_rule_codes": [],
  "records": [
    {
      "record_ref": "USER-OPAQUE-0001",
      "entity_type": "individual",
      "self_certification_status": "valid",
      "claimed_tax_residences": [
        "DE"
      ],
      "declared_fields": {
        "wallet_address_ref": "WALLET-REF-0001"
      },
      "transactions": [
        {
          "transaction_ref": "TXN-0001",
          "transaction_class": "crypto_to_fiat_exchange"
        },
        {
          "transaction_ref": "TXN-0002",
          "transaction_class": "staking_reward"
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_carf_reportable` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
