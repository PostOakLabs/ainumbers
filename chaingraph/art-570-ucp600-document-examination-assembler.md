# UCP 600 / ISBP 745 Document Examination Assembler

Recomputes the letter-of-credit document examination a checker already works from a paper checklist inside the 5-banking-day window, from structured fields the checker has transcribed off the presentation - no OCR, no document upload, no parsing of any document image or free text. Checks presentation timing against the credit's expiry date and the UCP 600 Art. 14(c) 21-calendar-day-after-shipment window (or the credit's own stated period); the Art. 14(b) 5-banking-day examination-window deadline when an examination-completion date is declared; Art. 30 quantity and amount tolerances, +/-5% or +/-10% when the credit qualifies the figure with 'about'; the Art. 28(f)(ii) insurance floor against the declared CIF/CIP value; cross-document consistency under Art. 14(d)/(e), including named-port conflicts and a checker-declared goods-description conformity flag; and draft tenor arithmetic against the credit's stipulated tenor. Every finding cites its article number. Verdict COMPLYING_PRESENTATION when no discrepancy is found, DISCREPANT when at least one is, INDETERMINATE when a required input (the credit amount or quantity, the expiry or latest-shipment date, the presentation date, or the invoice/transport-document fields) is absent. This is the examination side of the LC lifecycle - the companion tool tools/420-mt700-lc-field-validator.html validates the MT700 issuance message; the two are cross-linked, not duplicated. UCP 600 and ISBP 745 are cited by article/paragraph number only; their text is ICC copyright and is never reproduced, and this tool carries no claim of ICC endorsement.

- Page: https://ainumbers.co/chaingraph/art-570-ucp600-document-examination-assembler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-570-ucp600-document-examination-assembler.md
- MCP tool: examine_lc_document_presentation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- bank_holidays (array, required)
- documents (unknown, required)
- examination_date (unknown, required)
- goods_description_conforms (unknown, required)
- lc (unknown, required)
- presentation_date (unknown, required)

## Outputs

- clause_note (string, optional)
- cross_document (object, optional)
- decision (object, optional)
- drafts (array, optional)
- examination_window (object, optional)
- findings (array, optional)
- insurance_check (object, optional)
- presentation_date (string, optional)
- presentation_window (object, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- tolerances (object, optional)
- verdict (string, optional)

## Sample

```json
{
  "lc": {
    "amount_minor": 5000000,
    "quantity": {
      "value": 1000,
      "unit": "MT"
    },
    "expiry_date": "2026-07-31",
    "latest_shipment_date": "2026-06-30",
    "named_ports": {
      "loading": "Shanghai",
      "discharge": "Rotterdam"
    },
    "insurance_required": true
  },
  "presentation_date": "2026-06-20",
  "examination_date": "2026-06-24",
  "documents": {
    "invoice": {
      "amount_minor": 5000000,
      "quantity": {
        "value": 1000,
        "unit": "MT"
      },
      "goods_description": "Widgets, 1000 MT"
    },
    "transport_doc": {
      "shipment_date": "2026-06-15",
      "port_of_loading": "Shanghai",
      "port_of_discharge": "Rotterdam"
    },
    "insurance": {
      "amount_minor": 5500000,
      "cif_cip_value_minor": 5000000,
      "effective_date": "2026-06-15"
    },
    "drafts": [
      {
        "tenor_type": "sight",
        "amount_minor": 5000000,
        "drawee": "Buyer Bank plc"
      }
    ]
  },
  "goods_description_conforms": {
    "invoice_vs_transport": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `examine_lc_document_presentation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
