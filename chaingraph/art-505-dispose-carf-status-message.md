# CARF Status Message Disposition

Turns a returned Crypto-Asset Reporting Framework or DAC8 status message into a dispositioned break list: every file-level and record-level error the authority reported, tied to the record and the field that caused it, with the disposition that answers it. The differentiator is that a disposition signed in an earlier reporting cycle is carried forward against the same break reference, keeping the named signer and the originating cycle attached, so the answer to why an error is still open survives from one cycle to the next. A disposition is countable only when it is signed by a named signer: an unsigned one is rejected with its reason and the break stays open, because an unsigned disposition is a note rather than accountable evidence. The return path is not assumed. The OECD status message schema is an instrument for one competent authority to report errors back to another, and the OECD states it may also be used for domestic reporting to the extent the relevant jurisdiction's own law permits, which is a permission and not a guarantee. So the operator must declare that its jurisdiction returns a status message and name the channel; absent that declaration the node returns a stated verdict and produces no break list rather than implying a file came back. A deactivation list is a first-class input: a suppressed error code produces no break at all and the suppression is counted in the artifact. A record-level error whose document reference matches nothing in the submitted set is itself reported, because an operator that cannot say which record the authority is complaining about has a finding of its own. Error codes arrive as data and the schema version is a pinned policy input, never kernel source. Zero personal data by construction: records are identified by opaque references only. No clock is read, so cycle references are declared strings and nothing silently expires. Stated boundary: this dispositions a file the operator already holds. It does not fetch, submit or transmit anything, it makes no claim that any output is submittable, and it is not legal or tax advice.

- Page: https://ainumbers.co/chaingraph/art-505-dispose-carf-status-message.html
- Markdown twin: https://ainumbers.co/chaingraph/art-505-dispose-carf-status-message.md
- MCP tool: dispose_carf_status_message (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cycle_ref (unknown, required)
- dispositions (array, required)
- prior_dispositions (array, required)
- reporting_jurisdiction (unknown, required)
- schema_version (unknown, required)
- status_message (unknown, required)
- status_message_channel (unknown, required)
- status_message_return_declared (boolean, required)
- submission_ref (unknown, required)
- submitted_records (array, required)
- suppressed_error_codes (unknown, required)

## Outputs

- break_count (integer, optional)
- breaks (array, optional)
- carried_forward_count (integer, optional)
- cycle_ref (string, optional)
- dispositioned_break_count (integer, optional)
- message_ref (string, optional)
- note (string, optional)
- open_break_count (integer, optional)
- reporting_jurisdiction (string, optional)
- resolving_input (string, optional)
- schema_version (string, optional)
- status_message_channel (string, optional)
- status_message_return_declared (boolean, optional)
- submission_ref (string, optional)
- suppressed_break_count (integer, optional)
- suppressed_error_codes (array, optional)
- unresolved_record_reference_count (integer, optional)
- unsigned_dispositions_rejected (array, optional)
- verdict (string, optional)
- verdict_reason (string, optional)

## Sample

```json
{
  "submission_ref": "CARF-SUB-2027-IE-0001",
  "reporting_jurisdiction": "IE",
  "schema_version": "OECD-CARF-STATUS-MESSAGE-XML-SCHEMA-JUNE-2025",
  "cycle_ref": "CYCLE-2027-01",
  "status_message_return_declared": false,
  "status_message_channel": "",
  "suppressed_error_codes": [],
  "submitted_records": [
    {
      "doc_ref_id": "IE2027DOC0001",
      "record_ref": "USER-OPAQUE-0001"
    },
    {
      "doc_ref_id": "IE2027DOC0002",
      "record_ref": "USER-OPAQUE-0002"
    }
  ],
  "dispositions": [],
  "prior_dispositions": [],
  "status_message": {
    "message_ref": "STATUS-MSG-2027-IE-0001",
    "file_errors": [
      {
        "error_code": "FILE-ERR-50001",
        "error_detail": "The message reference identifier is not unique for this sending operator."
      }
    ],
    "record_errors": [
      {
        "error_code": "REC-ERR-80014",
        "doc_ref_id": "IE2027DOC0001",
        "field_path": "CryptoAsset/AccountHolder/Individual/TIN",
        "error_detail": "The tax identification number is absent for a claimed residence that requires one."
      },
      {
        "error_code": "REC-ERR-80022",
        "doc_ref_id": "IE2027DOC0002",
        "field_path": "CryptoAsset/Transactions/Transfer/AssetType",
        "error_detail": "The asset type is outside the permitted value set for this schema version."
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `dispose_carf_status_message` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
