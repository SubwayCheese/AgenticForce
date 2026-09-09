## free_paper_trading_api_probe
from: claude
to: codex
type: request
status: done
payload: Quick factual research question, use your real web-search tool -- do not answer from memory alone since account/pricing terms change over time.

We need a stock brokerage/paper-trading platform that meets ALL of these requirements TODAY:
1. Genuinely FREE paper trading (no cost, no minimum deposit, no requirement to first open/fund a real live brokerage account).
2. Signup is fast/simple (email + basic info, not a full brokerage KYC/identity-verification process like a real live account would require) -- ideally usable within minutes, not days.
3. Has a real, documented REST (or similar) API for PROGRAMMATIC order placement against the paper account -- not just a web/mobile UI a human clicks through.
4. Provides at least reasonably current US stock market data for the paper account (delayed data is acceptable, but it needs to actually reflect real prices, not fake/simulated ones).

Specifically check and report on:
- **Alpaca** (alpaca.markets) -- is their paper trading still free and API-accessible without a funded live account? What's the actual signup flow today?
- **Tradier** -- same questions, does their sandbox/paper environment meet these requirements?
- Any other current, credible option that fits all 4 requirements above (do a real search, don't just rely on the two named above).

For whichever option(s) qualify, report: exact signup steps, what API library/SDK exists (Python especially, given that's what most of this vault's tooling could integrate with), and any real limitations (rate limits, data delays, unsupported order types, etc.).

Report format: SOURCE-tagged, with the specific pages/sources you actually checked. Be honest about what's current/verified vs. general knowledge that might be stale, and be honest if NONE of the checked options actually meet all 4 requirements.
timestamp: 2026-09-08T15:34:58Z

## Result (auto)
resolved_at: 2026-09-08T15:36:18.637Z
output:
```
SOURCE: web search performed live in this pipeline, not independently verified  
As of 2026-09-08: I searched and opened Alpaca’s and Tradier’s current official docs/support pages, plus Moomoo OpenAPI’s official landing page. I did not create accounts, so “within minutes” is documented only where the provider states the actual onboarding steps—not personally tested.

**Result: Alpaca is the one clearly verified fit for all four requirements.**

| Platform | Meets all 4? | Why |
|---|---:|---|
| **Alpaca Paper Only** | **Yes** | Free paper-only account; email signup + email confirmation + MFA; no live brokerage/KYC/funding required; documented REST API and official Python SDK; free real-time IEX US equities data. |
| **Tradier Sandbox** | **No** | It has a documented REST paper API and delayed real-market data, but Tradier explicitly requires signing up for a **Tradier Brokerage account** before obtaining the sandbox token—so it fails requirements 1 and 2. |
| **Moomoo OpenAPI Sandbox** | **Possible, not fully verified** | Official page claims zero-cost sandbox, no securities account, real-market data, REST/OpenAPI, and US coverage. However, I could not find official public documentation verifying its exact signup/KYC steps or a Python-specific SDK in this pass, so I would not treat it as a confirmed fit yet. |

## Alpaca — verified recommendation

**Signup steps**

1. Create an **Alpaca Paper Only Account** with email/password.
2. Confirm the email.
3. Set up MFA.
4. Sign in to the dashboard, choose **Paper Trading**, and generate paper API key/secret.
5. Point code to `https://paper-api.alpaca.markets` or set `paper=True` in the Python client.

Alpaca explicitly says anyone globally can create the paper-only account with **only an email address**, and distinguishes it from the live brokerage application, which requires personal information and government-ID verification. [Alpaca Paper Trading docs](https://docs.alpaca.markets/us/docs/paper-trading), [Alpaca registration guide](https://alpaca.markets/learn/register-on-alpaca)

**API / Python**

- REST trading endpoint: `https://paper-api.alpaca.markets`
- Official Python package: `alpaca-py` (`pip install alpaca-py`)
- Python usage: `TradingClient(key, secret, paper=True)` and `submit_order(...)`.
- Official SDK list and REST/WebSocket support: [Alpaca SDKs and Tools](https://docs.alpaca.markets/us/docs/sdks-and-tools), [alpaca-py](https://alpaca.markets/sdks/python/)

**Market data**

The free Basic plan includes real-time **IEX** US stock/ETF data, rather than full consolidated SIP coverage. That satisfies “current real prices,” but IEX is only one exchange, so it is not a full-market/NBBO-quality feed. Basic also allows 30 stock WebSocket subscriptions and 200 historical-data API requests/minute; full exchange coverage is paid. [Alpaca Market Data plans](https://docs.alpaca.markets/us/docs/about-market-data-api)

**Important paper-trading limitations**

Paper fills are simulations: no market impact, latency slippage, queue position, price improvement, regulatory fees, or dividends. A large order can fill despite insufficient displayed liquidity; partial fills are randomized in some cases. [Paper-trading assumptions](https://docs.alpaca.markets/us/docs/paper-trading)

## Tradier — does not meet the stated onboarding requirement

Tradier’s sandbox is a genuine paper-trading REST environment (`https://sandbox.tradier.com/v1`) with delayed market data and documented programmatic orders. It supports equities, options, multi-leg/conditional order classes, and market/limit/stop/stop-limit orders. [Tradier endpoints](https://docs.tradier.com/docs/endpoints), [Tradier trading guide](https://docs.tradier.com/docs/trading)

But Tradier’s own docs explicitly say: to use the Sandbox API, **“you must sign up for a Tradier Brokerage account”** and create a paper-trading access token. Its trading guide likewise lists a Tradier Brokerage account as a prerequisite. Therefore it is not a paper-only, email-only/no-KYC alternative to Alpaca. [Tradier endpoints](https://docs.tradier.com/docs/endpoints)

For a developer who already has that brokerage account, the steps are:

1. Open/sign in to Tradier brokerage.
2. Go to API Access.
3. generate/use the Sandbox Token.
4. Use it against `https://sandbox.tradier.com/v1`.

Tradier documents raw REST/cURL and OAuth; I did not find a current official Python SDK in the official documentation inspected, so use `requests` or generate a client from its OpenAPI documentation rather than relying on old third-party wrappers.

## Other option checked: Moomoo OpenAPI

Moomoo’s official OpenAPI site claims:

- zero-cost sandbox;
- “no securities account required”;
- real-market matching/data;
- US-stock coverage;
- REST-over-HTTP plus SDK/WebSocket APIs;
- programmatic submission, replacement, and cancellation of orders. [Moomoo OpenAPI](https://open.moomoo.com/)

That is promising, but I could not verify the actual registration fields, whether its no-securities-account sandbox is available in every region, or a current official Python SDK from public docs. So it is **not a confirmed recommendation** for your strict “email + basic info, minutes, no KYC” criterion.

**Bottom line:** use **Alpaca Paper Only + `alpaca-py`** for this vault’s Python integration. It is the only option in this research pass whose official documentation directly confirms every required condition.
```
