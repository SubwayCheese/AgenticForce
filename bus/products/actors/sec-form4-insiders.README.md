# SEC Form 4 Insider Trades API: insider buys and sells as clean JSON

Get the latest **SEC Form 4 insider trading filings** for any US-listed stock as structured JSON. Every filing is parsed for you: who traded, their role, whether it was a purchase or a sale, the number of shares, the price, the dollar value and the holdings afterwards. Data comes straight from public SEC EDGAR filings, so there is no API key and no scraping of third-party sites.

## What you get

For each transaction the Actor returns one row with `ticker`, `issuer`, `insider`, `insiderRole`, `date`, `code`, `shares`, `pricePerShare`, `valueUsd`, `acquiredDisposed` and `sharesOwnedAfter`. It also saves a `SUMMARY` record with total insider buying versus selling per ticker and the number of distinct buyers.

Transaction codes follow the SEC's own: **P** = open-market purchase, **S** = open-market sale, **M** = option exercise, **A** = award, **G** = gift, **F** = tax withholding.

## How to use it

1. Enter one or more tickers, for example `AAPL` and `MSFT`.
2. Choose how many recent Form 4 filings to fetch per ticker (1-20).
3. Run it and download the dataset as JSON, CSV or Excel, or call it from the API.

Example input:

```json
{ "tickers": ["AAPL", "NVDA"], "filingsPerTicker": 5 }
```

## Who it is for

- Traders and researchers tracking **insider buying and selling**.
- Developers building dashboards, alerts or screens on SEC data.
- **AI agents** that need clean insider-transaction data. It works through the Apify API and the Apify MCP server.

## Pricing

Pay per event: you pay a small fixed amount for each filing parsed. You control the cost with the number of tickers and filings per ticker, and you can set a maximum spend per run.

## Good to know

- SEC asks callers to identify themselves. You can add your contact email in the input; it is only sent to sec.gov in the User-Agent header.
- The Actor respects SEC fair-access limits.
- Filings appear on EDGAR shortly after they are submitted; this Actor reports them as filed.

## Disclaimer

This tool reports public SEC filings as-is. It is not investment advice, makes no prediction about any security and may contain errors or omissions. Verify against the original filing on sec.gov.
