# Authenticator Assurance Level Evaluator

Rates whether a DECLARED authenticator set and session policy reach a DECLARED target level of a caller-supplied, versioned authentication assurance framework - never a hardcoded framework such as NIST SP 800-63B or the eIDAS levels of assurance. This is the authentication counterpart to the identity-proofing evaluator (art-523), on the same framework-as-input pattern: the framework supplies levels ordered lowest-to-highest, each carrying criteria in a shared generic vocabulary (a distinct-factor-category floor, required factor categories, phishing-resistance / verifier-impersonation-resistance / hardware-binding / dynamic-authentication requirements, reauthentication and idle-timeout ceilings in minutes, and restricted authenticator kinds). The kernel never interprets a framework it was not given: every threshold and restriction comes from the declared framework, and authenticator kinds come from the node's own closed enum (password, otp_device, otp_sms, crypto_software, crypto_hardware, passkey_synced, passkey_device_bound, biometric_local), with factor categories only ever tested for set membership in the caller's own vocabulary. A criterion whose declared value is malformed is flagged AAL_DEFINITION_INSUFFICIENT - the definition cannot express what it asks for - which is distinct from AAL_SHORTFALL (declared data failing a well-formed criterion, reported per criterion as {criterion, required, found}); the two are never conflated. When the target level is not met, achieved_level falls back to the highest fully-met level below it. The named compliance flags cover a restricted authenticator in use, missing phishing resistance, an exceeded reauthentication interval, and a short factor count. Honest posture: this evidences that a declared authenticator set was measured against a declared policy. It does not assert anyone controls any authenticator, does not verify possession, biometrics or device state, and carries no user identifiers - inputs are kinds, boolean capabilities and minute intervals, nothing else. The shipped example frameworks in its fixtures are modeled on NIST SP 800-63B-4 AAL1-3 and on the authentication section of the eIDAS implementing regulation's annex; both are caller data, and no output implies endorsement by NIST, the European Commission or any government.

- Page: https://ainumbers.co/chaingraph/art-826-authenticator-assurance-level.html
- Markdown twin: https://ainumbers.co/chaingraph/art-826-authenticator-assurance-level.md
- MCP tool: compute_authn_assurance_level (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- framework (object, optional)
- target_level (string, optional)
- authenticators (array, optional)
- session (object, optional)

## Outputs

- framework_ref (object, optional)
- target_level (string, optional)
- target_level_found (boolean, optional)
- levels_defined (integer, optional)
- authenticator_count (integer, optional)
- session_declared (boolean, optional)
- criteria_evaluated (integer, optional)
- achieved_level (string,null, optional)
- meets_target (boolean, optional)
- unmet_criteria (array, optional)
- undecidable_count (integer, optional)
- undecidable (array, optional)
- note (string, optional)

## Sample

```json
{
  "framework": {
    "id": "eidas-example",
    "version": "2015-09",
    "levels": [
      {
        "level_id": "low",
        "min_factors": 1
      },
      {
        "level_id": "substantial",
        "min_factors": 2,
        "dynamic_authentication_required": true
      },
      {
        "level_id": "high",
        "min_factors": 2,
        "dynamic_authentication_required": true,
        "hardware_bound_required": true
      }
    ]
  },
  "target_level": "low",
  "authenticators": [
    {
      "kind": "password",
      "factor_kinds": [
        "knowledge"
      ],
      "phishing_resistant": false,
      "hardware_bound": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_authn_assurance_level` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
