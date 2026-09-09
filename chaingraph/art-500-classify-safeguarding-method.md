# CASS 15 Safeguarding Method Classifier

Classifies each caller-declared funds stream of a UK payment or e-money firm on three questions: whether the funds are relevant funds, whether the safeguarding method asserted for them (segregation under CASS 15.3, or an insurance policy or comparable guarantee under CASS 15.5) is coherent with the designated-account, acknowledgement-letter and instrument facts supplied, and where the supplied facts do not settle the answer. Every judgment_required outcome names what is undetermined, which single input would resolve it, and who decides, so a judgment is never a bare flag. Also computes a SUP 3A safeguarding audit exemption indicator from a relevant funds high-water figure observed over at least 53 weeks. Single-run and stateless. A coherence verdict is a consistency check on the facts as declared, never a determination that the firm has complied with or breached CASS 15, and never an opinion on whether an insurance policy or guarantee is legally effective.

- Page: https://ainumbers.co/chaingraph/art-500-classify-safeguarding-method.html
- Markdown twin: https://ainumbers.co/chaingraph/art-500-classify-safeguarding-method.md
- MCP tool: classify_safeguarding_method (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- relevant_funds_high_water_minor_units (unknown, required)
- streams (array, required)
- weeks_observed (unknown, required)

## Outputs

- as_of_date (string, optional)
- audit_exemption_indicator (object, optional)
- citations (object, optional)
- classification_verdict (string, optional)
- coherent_count (integer, optional)
- determinations (array, optional)
- incoherent_count (integer, optional)
- judgment_stream_count (integer, optional)
- minor_unit_exponent (integer, optional)
- note (string, optional)
- open_judgment_count (integer, optional)
- rationale (array, optional)
- ruleset (object, optional)
- stream_count (integer, optional)

## Sample

```json
{
  "as_of_date": "2026-07-29",
  "relevant_funds_high_water_minor_units": 4200000,
  "weeks_observed": 60,
  "streams": [
    {
      "stream_ref": "STRM-001",
      "funds_category": "emoney_relevant_funds",
      "method_asserted": "segregation",
      "designated_account_status": "designated_relevant_funds_bank_account",
      "acknowledgement_letter_status": "received_and_countersigned",
      "receipt_to_segregation_timing": "same_business_day"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_safeguarding_method` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
