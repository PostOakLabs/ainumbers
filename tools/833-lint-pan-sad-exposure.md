# PAN and SAD Exposure Linter

Lints a caller-declared token-record schema against the published PCI DSS v4.0.1 account-data rules and reports which declared surfaces expose more account data than the rule allows. The input is a synthetic record schema: typed fields (primary account number, card verification code, PIN or PIN block, full track data, deterministic digest, other) each carrying a mask expression string, an optional alias template, declared search-index expressions, and a list of stored data elements each with a sensitive-authentication-data class, a retention state, a storage location class and an encryption flag. Checks: per-field display exposure against the first-six-and-last-four digit masking ceiling (Requirement 3.4.1), the same ceiling over the alias template and each declared search-index expression, retention of sensitive authentication data after authorization including encrypted storage (Requirements 3.3.1, 3.3.1.1, 3.3.1.2, 3.3.1.3), and digest fields presented as rendering the PAN unreadable, for a fragment digest target or an unkeyed hash (Requirements 3.5.1, 3.5.1.1). Carve-outs the caller owns the facts for (non-persistent short-term retention conditions, digest-and-truncation correlation controls) resolve to named manual-review flags, never to a clean pass; unrecognized input values refuse the whole call with INPUT_REFUSED rather than guessing. Scope limits: the node sees only what the caller declares; it expresses no opinion on business-need role lists, issuer carve-outs, deletion processes, key management, or display surfaces it was not told about; and it checks a schema declaration, not a production data store, so a verdict is not a PCI DSS assessment. Findings arrive as Policy Mandate-ready flags with a mirrored issues list; deterministic, zero network, zero PII.

- Page: https://ainumbers.co/tools/833-lint-pan-sad-exposure.html
- Markdown twin: https://ainumbers.co/tools/833-lint-pan-sad-exposure.md
- MCP tool: lint_pan_sad_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "record": {
    "record_type": "card_token",
    "container_path": "/pci/high/cards",
    "alias_template": "suffix:4:card-alias",
    "search_index_expressions": [
      "suffix:4:pan-index"
    ],
    "fields": [
      {
        "name": "pan",
        "value_class": "primary_account_number",
        "mask_expression": "prefix:6,suffix:4"
      },
      {
        "name": "cvc_display",
        "value_class": "card_verification_code",
        "mask_expression": "redact:all"
      }
    ]
  },
  "stored_elements": [
    {
      "name": "pan_index_store",
      "sad_class": "none",
      "retention": "after_authorization",
      "storage_location_class": "persistent",
      "encrypted": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_pan_sad_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
