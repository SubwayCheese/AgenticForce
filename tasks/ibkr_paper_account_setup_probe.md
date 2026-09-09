## ibkr_paper_account_setup_probe
from: claude
to: codex
type: request
status: done
payload: Quick factual research question, use your real web-search tool -- do not answer from memory alone since account-signup requirements and processes change over time.

What does a person actually need to do TODAY to get a working Interactive Brokers (IBKR) PAPER TRADING account -- specifically one usable for API/programmatic access (not just the web/mobile trading UI)? Cover, with sources:

1. Does using IBKR's paper trading feature require first opening/applying for a real (live) brokerage account, even if it's never funded? Or is there a way to get paper-trading-only access without a live account application?
2. If a live account application is required, what's the actual signup process like (identity verification, approval time, any cost)?
3. How does someone enable/access the paper trading account specifically, once they have an IBKR account (e.g. via IBKR's Client Portal, TWS, IB Gateway)?
4. What's required for API/programmatic access to the paper account specifically (e.g. does it need TWS or IB Gateway running locally, API permissions to enable, etc.)? This matters because the end goal is an automated system placing paper orders programmatically, not a human using the IBKR app manually.
5. Any known current limitations or gotchas people report with IBKR paper trading via API (rate limits, data feed requirements, session timeouts, etc.)?

Report format: SOURCE-tagged, with the specific pages/sources you actually checked. Be honest about what's current/verified vs. general knowledge that might be stale.
timestamp: 2026-09-08T15:18:54Z

## Result (auto)
resolved_at: 2026-09-08T15:20:59.345Z
output:
```
SOURCE: web search performed live in this pipeline, not independently verified  
As of 2026-09-08: I searched and checked IBKR’s current Paper Trading, account-application, TWS/IB Gateway, Client Portal API, market-data, and API-limit documentation. One material inconsistency exists in IBKR’s own paper-account pages on whether the live account must be funded; I call it out below.

## Bottom line

For a **working IBKR paper account that can place orders programmatically**, plan on opening a normal IBKR brokerage account and completing identity/account approval. There is no documented “paper-trading-only API account” path. The least ambiguous route is:

1. Open and get approved for a regular IBKR account.
2. Request/create its paper account in Client Portal; choose separate paper credentials.
3. For automation, use the **TWS API via TWS or IB Gateway** logged into Paper, with socket API enabled and Read-Only disabled.
4. If instead using IBKR’s **Client Portal/Web API**, the current docs explicitly require the associated live account to be **fully open, funded, and IBKR Pro**.

## 1. Live account required? Paper-only path?

**Yes, a real IBKR brokerage-account application is required.** IBKR’s current paper-account lesson says paper access comes only after opening an actual account; after approval, paper trading can be requested in Client Portal. It provides separate paper username/password and account number. [S1](https://www.interactivebrokers.com/campus/trading-lessons/how-to-open-an-ibkr-paper-trading-account/)

IBKR does offer a “Try the Demo” login from TWS using an email address, but that is a demo/training facility—not documentation of a paper brokerage account usable for automated order-placement API testing. [S2](https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/)

### Funding caveat — IBKR’s docs conflict

- The recent paper-account lesson says: actual account required, but “you don’t need to fund your live account straight away”; it must be approved before paper is available. [S1](https://www.interactivebrokers.com/campus/trading-lessons/how-to-open-an-ibkr-paper-trading-account/)
- Its heading and several other official pages say paper requires an **approved and funded** regular account. [S3](https://www.interactivebrokers.com/docs/tws-api/doc/notes-limitations/limitations/paper-trading)
- For the **Web/Client Portal API specifically**, IBKR is unequivocal: the live account must be fully open, **funded**, and **IBKR Pro**. [S4](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/)

So: an approved but unfunded account may currently be enough to request/use paper in the platforms, per S1; but do **not** count on that for programmatic use—especially not the Web API. Fund it if you need a reliable, supported API setup.

## 2. Signup: identity, approval time, cost

For an individual application, expect to provide legal identity/contact information, address, date/country of birth, citizenship, tax residency/TIN, employment, financial/investment-experience information, and banking/brokerage information for funding. IBKR says it generally verifies US applicants’ name and address electronically; if verification fails or for many non-US cases, it can require photo ID plus address proof such as a utility bill, bank statement, lease, or mortgage/deed. [S5](https://www.interactivebrokers.com/en/general/what-you-need-inv.php)

**Approval time:** IBKR does not publish a reliable universal turnaround. Its account-status documentation says that once an application reaches **Pending Approval**, it “should be opened by the following business day”; missing documents or compliance review can extend it. [S6](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/)

**Cost:** There is no published account-opening fee, no minimum balance, and no maintenance/inactivity fee on IBKR’s current general pricing page. That does **not** mean every capability is free: trading commissions, exchange fees, and paid market-data subscriptions can apply. [S7](https://www.interactivebrokers.com/en/pricing/commissions-home.php)

## 3. Enabling and accessing paper trading

After the regular account is approved:

1. Log into **Client Portal**.
2. Go to profile/head-and-shoulders icon → **Settings**.
3. Under **Account Configuration**, select **Paper Trading Account**.
4. Create the paper username and password; IBKR creates a distinct paper account number.
5. IBKR says it is normally ready within 24 hours / by the following business day for requests submitted before its stated cutoff. [S8](https://www.interactivebrokers.com/campus/trading-lessons/request-paper-trading-account/)

Then log into TWS, IB Gateway, Client Portal, or mobile with the **Paper Trading** selector and the paper credentials. Paper account permissions, base currency, and market-data subscriptions mirror the live account. [S9](https://www.interactivebrokers.com/campus/glossary-terms/paper-trading-account/)

## 4. Programmatic paper-order access

### Recommended for an automated system: TWS API socket

Run either **TWS** or the lighter-weight **IB Gateway** locally/on the automation host, log in using the paper credentials, and have your program connect to it by socket.

In TWS/IB Gateway API settings:

- Enable **ActiveX and Socket Clients**.
- Disable **Read-Only API**—it is enabled by default and blocks API orders.
- Use/match the configured socket port: defaults are **TWS Paper 7497** and **IB Gateway Paper 4002**. [S10](https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/)

TWS and IB Gateway are equivalent from an API program’s perspective; the latter is intended as a lighter API host. [S11](https://www.interactivebrokers.com/docs/tws-api/doc/architecture/the-trader-workstation/the-ib-gateway)

### Client Portal / Web API alternative

This is REST/WebSocket rather than the TWS socket API, but retail users must run the local **Client Portal Gateway** (Java), browse to `https://localhost:5000`, and authenticate. IBKR says retail API use currently relies on this gateway; TWS is not required simultaneously. [S12](https://www.interactivebrokers.com/campus/trading-lessons/launching-and-authenticating-the-gateway/)

For this route, again, IBKR’s current requirement is **funded IBKR Pro live account** for both live and associated paper access. [S4](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/)

## 5. Current limitations and operational gotchas

- **Paper fills are simulations, not execution-quality tests.** No VWAP, Auction, RFQ, or Pegged-to-Market; no deep-book fill model; limited combos; stop/complex behavior differs; US options do not receive penny fills; mutual funds are unsupported. [S9](https://www.interactivebrokers.com/campus/glossary-terms/paper-trading-account/)
- **Market data is the big practical constraint.** Paper inherits the live account’s permissions; without subscriptions, data is delayed where available. Real-time subscriptions are paid and IBKR says the live account must be funded to maintain them. If shared with paper, you cannot consume that data in live and paper simultaneously. [S8](https://www.interactivebrokers.com/campus/trading-lessons/request-paper-trading-account/)
- **TWS API pacing:** 50 outbound messages/second is the documented ceiling; exceed it and TWS may disconnect the client. Market-data line limits are shared across TWS and API and depend on the account/data entitlements. [S13](https://www.interactivebrokers.com/docs/tws-api/doc/error-handling/error-codes)
- **Connection capacity:** up to 32 API clients can connect to one TWS/IB Gateway instance. [S14](https://www.interactivebrokers.com/docs/tws-api/doc/architecture/introduction)
- **Session maintenance:** TWS/IB Gateway are designed for daily restart. Autorestart can reduce interruption, but IBKR says re-entering security credentials is needed after the Saturday-night reset. [S11](https://www.interactivebrokers.com/docs/tws-api/doc/architecture/the-trader-workstation/the-ib-gateway)
- **Client Portal Gateway sessions can conflict with other logins.** IBKR directs users to log out of other platforms before authenticating the same account, and stale/competing sessions can produce “not authenticated” or unavailable trading/data sessions. [S12](https://www.interactivebrokers.com/campus/trading-lessons/launching-and-authenticating-the-gateway/)
- **Do not choose FIX for this goal:** IBKR’s current FIX integration material says paper accounts are not compatible with FIX. [S15](https://www.interactivebrokers.com/campus/wp-content/uploads/sites/2/2024/07/IBKR-FIX-Integration-Form.pdf)
```
