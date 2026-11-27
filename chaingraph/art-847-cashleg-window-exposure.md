# Cash-Leg Window Exposure

Computes how long a token leg that settles at any hour waits for a cash leg that only moves while a payment rail is open. From a token leg instant and either a list of UTC open windows or a caller-declared rail calendar (weekday window rules, UTC offsets declared by date range, holidays), it returns the exposure in seconds, the principal-seconds product as an exact decimal string, the next window open and close, a weekend-crossing flag, and an optional carry cost at a stated funding rate (actual over 365, rounded half to even). The verdict is ATOMIC_POSSIBLE inside an open window, WINDOWED when a later window opens within the horizon, and NO_WINDOW_IN_HORIZON otherwise. The node hardcodes no rail calendar and reads no clock: every hour, offset and holiday is a caller-asserted input, and the calendar must declare the dates it covers. Integers and strict UTC time strings only; floats, nulls, numeric principals, impossible dates and undeclared offsets refuse by named code. It computes no balance-sheet saving and names no unannounced product.

- Page: https://ainumbers.co/chaingraph/art-847-cashleg-window-exposure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-847-cashleg-window-exposure.md
- MCP tool: cashleg_window_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- token_leg_time (string, optional): Instant the token leg settles, strict UTC YYYY-MM-DDTHH:MM:SSZ.
- as_of (string, optional): Caller-declared evaluation instant, strict UTC.
- principal_minor_units (string, optional): Principal in integer minor units, decimal string, at most 18 digits.
- funding_rate_bp (number, optional): Optional funding rate in whole basis points, 0 to 100000.
- horizon_days (number, optional): Optional search horizon in whole days, 1 to 60; 14 when absent.
- cash_instrument (string, optional): Optional label: fiat_bank_money, stablecoin, deposit_token or future_instrument.
- cash_leg_open_windows (array, optional): Declared UTC cash windows of open_utc and close_utc. Declare exactly one of this or rail_calendar.
- rail_calendar (object, optional): Declared versioned rail table: weekday window rules, UTC offsets by date range and holidays.

## Outputs

- as_of (string,null, required)
- calendar_version (string,null, required)
- carry_cost_minor_units (string,null, required)
- carry_rounding (string, required)
- cash_instrument (string,null, required)
- crosses_weekend (boolean,null, required)
- day_count (string, required)
- domain_errors (array, required)
- exposure_principal_seconds (string,null, required)
- exposure_seconds (number,null, required)
- funding_rate_bp (number,null, required)
- horizon_days (number,null, required)
- next_cash_window_close (string,null, required)
- next_cash_window_open (string,null, required)
- principal_minor_units (string,null, required)
- rail_id (string,null, required)
- refusal_code (null,string, required)
- source_pin (string,null, required)
- token_leg_time (string,null, required)
- valid_input (boolean, required)
- verdict (string,null, required)
- warnings (array, required)

## Sample

```json
{
  "principal_minor_units": "100000000000",
  "as_of": "2026-10-01T00:00:00Z",
  "token_leg_time": "2026-10-03T00:00:00Z",
  "rail_calendar": {
    "rail_id": "fedwire-funds-service",
    "calendar_version": "fedwire-hours-and-k8-pinned-2026-11-12",
    "source_pin": "fedwire-nss-operating-hours-2026-11-12 (hours); fed-holiday-k8-2026-11-12 (holidays)",
    "covers_from": "2026-01-01",
    "covers_to": "2027-12-31",
    "window_rules": [
      {
        "weekdays": [
          1,
          2,
          3,
          4,
          5
        ],
        "open_day_offset": -1,
        "open_local": "21:00",
        "close_day_offset": 0,
        "close_local": "19:00"
      }
    ],
    "utc_offset_segments": [
      {
        "from_date": "2026-01-01",
        "to_date": "2026-03-07",
        "offset_minutes": -300
      },
      {
        "from_date": "2026-03-08",
        "to_date": "2026-10-31",
        "offset_minutes": -240
      },
      {
        "from_date": "2026-11-01",
        "to_date": "2027-03-13",
        "offset_minutes": -300
      },
      {
        "from_date": "2027-03-14",
        "to_date": "2027-11-06",
        "offset_minutes": -240
      },
      {
        "from_date": "2027-11-07",
        "to_date": "2027-12-31",
        "offset_minutes": -300
      }
    ],
    "holidays": [
      "2026-01-01",
      "2026-01-19",
      "2026-02-16",
      "2026-05-25",
      "2026-06-19",
      "2026-09-07",
      "2026-10-12",
      "2026-11-11",
      "2026-11-26",
      "2026-12-25",
      "2027-01-01",
      "2027-01-18",
      "2027-02-15",
      "2027-05-31",
      "2027-07-05",
      "2027-09-06",
      "2027-10-11",
      "2027-11-11",
      "2027-11-25"
    ]
  },
  "cash_instrument": "fiat_bank_money",
  "funding_rate_bp": 450
}
```

## Verify

Run the sample policy_parameters through MCP tool `cashleg_window_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
