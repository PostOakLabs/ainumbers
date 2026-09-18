# DTC Corporate Actions ISO 20022 Message Validator

Validates the structural message-shape of a single DTC corporate-action event message (notification / election / allocation) against the ISO 20022 field set migrated under DTCC Important Notice 23890-26 (legacy corporate-actions message format decommission - a DTCC operator mandate, not a regulatory deadline: PSE testing 2026-01, Test Facility 2026-03, PROD testing 2026-07, legacy decommission Q3 2027). Checks required-field presence per message function, ISO 20022 CAEV event-type code, CUSIP format, DTC participant number, and date formats. Message-shape validation only - does NOT compute entitlement, dividend, rights, or split amounts; that half is corporate-action entitlement recompute (art-547), which chains from this node's output.

- Page: https://ainumbers.co/chaingraph/art-546-dtcc-ca-iso20022-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-546-dtcc-ca-iso20022-validator.md
- MCP tool: validate_dtcc_ca_iso20022_message (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allocated_quantity (any, required): type not evidenced by kernel source
- allocation_date (any, required): type not evidenced by kernel source
- cusip (any, required): type not evidenced by kernel source
- dtc_participant_number (any, required): type not evidenced by kernel source
- election_deadline (any, required): type not evidenced by kernel source
- election_option (any, required): type not evidenced by kernel source
- event_type (any, required): type not evidenced by kernel source
- message_function (any, required): type not evidenced by kernel source
- payable_date (any, required): type not evidenced by kernel source
- record_date (any, required): type not evidenced by kernel source
- reference_id (any, required): type not evidenced by kernel source

## Outputs

- disambiguation (string, optional)
- dtcc_operator_mandate_basis (string, optional)
- error_count (integer, optional)
- event_type (string, optional)
- message_function (string, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- readiness_pct (integer, optional)
- reference_id (string, optional)
- structure_valid (boolean, optional)
- table_source (string, optional)
- table_version (string, optional)
- violations (array, optional)

## Sample

```json
{
  "message_function": "NOTIFICATION",
  "event_type": "DVCA",
  "cusip": "037833100",
  "dtc_participant_number": "0443",
  "record_date": "2027-01-15",
  "payable_date": "2027-02-01",
  "reference_id": "CA-OPAQUE-2027-0001"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_dtcc_ca_iso20022_message` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
