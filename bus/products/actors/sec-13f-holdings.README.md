# SEC 13F Holdings API: institutional positions and quarter-over-quarter changes

Pull the latest **SEC Form 13F holdings** for any institutional investment manager and see what changed since last quarter: **new, exited, increased and decreased positions**, all as clean JSON. Built on public SEC EDGAR filings, with no API key needed.

## What you get

Each row contains the filer `cik`, the `issuer`, `cusip`, share class, reported `valueUsd`, and share counts. When you compare with the previous quarter, each row also has `status` (new, exited, increased, decreased or unchanged), `previousShares`, `currentShares`, `sharesDelta` and `pctChange`, sorted by the largest share change first.

## How to use it

1. Enter one or more filer CIK numbers, for example `1067983` for Berkshire Hathaway.
2. Set the maximum number of rows per filer.
3. Leave "Compare with previous quarter" on to see the changes, or turn it off for a plain holdings list.

Example input:

```json
{ "ciks": ["1067983"], "maxRowsPerFiler": 50, "compareWithPreviousQuarter": true }
```

## Who it is for

- Investors and analysts following what large funds are **buying and selling**.
- Developers building fund trackers, screens and alerts.
- **AI agents** that need structured holdings data through the Apify API or the Apify MCP server.

## Pricing

Pay per event: a small fixed amount for each holding row returned. You control cost with the number of filers and the row limit, and can set a maximum spend per run.

## Good to know

- 13F filings are delayed: they are filed up to 45 days after quarter end and only cover long equity positions above the reporting threshold. They do not show short positions.
- The Actor handles both namespaced and plain XML information tables.
- SEC asks callers to identify themselves; you can add a contact email in the input, sent only to sec.gov in the User-Agent header.

## Disclaimer

This tool reports public SEC filings as-is. It is not investment advice, makes no prediction about any security and may contain errors or omissions. Verify against the original filing on sec.gov.
