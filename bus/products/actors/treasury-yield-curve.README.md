# US Treasury Yield Curve API: daily par yields, 2s10s spread and inversion signal

Get the **US Treasury daily par yield curve** as clean JSON, with curve-shape signals added: the **2s10s spread**, an **inversion flag** and the **change versus the previous day** for every tenor. The data comes from the public U.S. Treasury feed, so there is no API key.

## What you get

One row per trading day with the yield for each available tenor (`1M`, `2M`, `3M`, `4M`, `6M`, `1Y`, `2Y`, `3Y`, `5Y`, `7Y`, `10Y`, `20Y`, `30Y`) in percent, plus a `signals` object: `spread2s10s`, `inverted` and `changeVsPrevious`. A `SUMMARY` record holds the latest curve signals. Missing tenors are simply left out, never returned as NaN.

## How to use it

1. Choose a year (defaults to the current year).
2. Set how many of the most recent trading days to return.
3. Run it and export as JSON, CSV or Excel, or call it through the API.

Example input:

```json
{ "year": 2026, "maxDays": 30 }
```

## Who it is for

- Macro researchers and investors watching the **yield curve and inversion**.
- Developers building rate dashboards and alerts.
- **AI agents** that need reliable Treasury rates through the Apify API or the Apify MCP server.

## Pricing

Pay per event: a small fixed amount for each day of curve data returned. You control the cost with the number of days and can set a maximum spend per run.

## Good to know

- Rates are the Treasury's published daily par yield curve values, as reported.
- Data for the current day appears after the Treasury publishes it.

## Questions

**Do I need an API key?** No. The Actor reads the public Treasury feed.

**Can I schedule it?** Yes, use Apify schedules to fetch fresh curve data daily and pipe it to your own tools.

## Disclaimer

This tool reports public U.S. Treasury data as-is. It is not investment advice, makes no prediction and may contain errors or omissions. Verify against home.treasury.gov.
