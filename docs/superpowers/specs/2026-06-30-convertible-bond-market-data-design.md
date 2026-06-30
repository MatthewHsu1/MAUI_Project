# Convertible Bond Market Data — Design

**Date:** 2026-06-30
**Status:** Approved (pending spec review)
**Related:** [docs/convertible-bond-conversion.md](../../convertible-bond-conversion.md)

## 1. Purpose

Let the app pull Taiwan convertible-bond (可轉換公司債) data from free public
open-data sources and compute the conversion valuation documented in
[convertible-bond-conversion.md](../../convertible-bond-conversion.md):

```
ConversionShares = ParValue / ConversionPrice
ConversionValue  = ConversionShares * UnderlyingStockPrice
InTheMoney       = ConversionValue > BondMarketPrice
```

Data is pulled over HTTP from structured open-data APIs (no web scraping, no
Python), cached into the existing SQLite database, and exposed to the UI through
Application use cases.

## 2. Scope

**In scope (v1):**
- Three open-data API clients: CB issuance terms, CB daily quote, stock quote.
- A `MarketDataProvider` gateway that composes the clients and maps raw API
  shapes to Domain entities.
- Domain entities + a pure conversion-math value object.
- EF Core persistence of convertible bonds (local cache) with a manual-seed
  fallback.
- Two use cases: refresh-from-network, and read-and-valuate.
- Unit tests across Domain, Infrastructure, and Application.

**Out of scope (v1):**
- Real-time / intraday data (free feeds are end-of-day; the abstraction allows a
  future real-time provider without touching Domain/Application/UI).
- UI screens (this slice ends at the Application DTO; UI is separate work).
- Anti-dilution recalculation of conversion price (we store what the feed
  reports).

## 3. Why not LEAN / Scrapling

- **LEAN** is a backtesting/live-trading engine, not a data client; it does not
  carry Taiwan CB data and will not fit inside a MAUI client. Rejected.
- **Scrapling** is Python + Playwright. This is a .NET MAUI app — bundling a
  Python runtime and headless browser is unviable, and would force a separate
  sidecar service to solve a problem we do not have (the data is structured open
  data, not HTML that needs scraping). Rejected. If scraping were ever required,
  the in-codebase choice is a C# library (HtmlAgilityPack / AngleSharp).

## 4. Data sources (free, public)

| Need | Source | Notes |
|---|---|---|
| Conversion **terms** (conversion price, par value, dates) | TPEx CB issuance dataset — [data.gov.tw #11406](https://data.gov.tw/dataset/11406) via TPEx OpenAPI | Static per bond; rarely changes |
| Bond **daily market price** | [TPEx CB daily query](https://www.tpex.org.tw/web/bond/bonds_info/cbq/NewCB_day_qry.php) | End-of-day |
| Underlying **stock price** | [TWSE OpenAPI](https://openapi.twse.com.tw/) / TPEx stock quotes | End-of-day |

The TPEx **web** server returns `403` to naive automated user-agents; the
**open-data API** endpoints are for programmatic use. The HTTP pipeline sets a
normal `User-Agent` header to avoid being blocked.

## 5. Architecture

Follows the existing Clean Architecture layering and the SoleCore "Clients"
pattern (one folder per external source; a raw `IXxxApiClient` wrapped by a
domain-facing gateway). Folders are named by **technical role** to stay
consistent with the existing `Persistence/` convention.

### 5.1 Domain (`AppName.Domain`) — concepts + math, zero I/O

```
Entities/
  ConvertibleBond.cs       // Symbol, Name, ParValue, ConversionPrice, UnderlyingSymbol
  BondQuote.cs             // bond market price + as-of date
  StockQuote.cs            // underlying stock price + as-of date
ValueObjects/
  ConversionValuation.cs   // ConversionShares, ConversionValue, IsInTheMoney (pure)
Abstractions/
  IMarketDataProvider.cs   // GetIssuanceTermsAsync, GetBondQuoteAsync, GetStockQuoteAsync
  IConvertibleBondRepository.cs  // GetAllAsync, GetBySymbolAsync, UpsertAsync
```

- All money/price fields use `decimal`.
- `ConversionValuation` is computed purely from a `ConvertibleBond` + bond price
  + stock price. No network, fully unit-testable.
- Per project CLAUDE.md: every property gets `/// <summary>` + `[DisplayName(...)]`;
  interfaces are fully documented; implementations use `/// <inheritdoc/>`.

### 5.2 Infrastructure (`AppName.Infrastructure`)

```
Clients/
  Tpex/
    TpexHttpPipeline.cs            // AddTpexHttpClients() — typed HttpClient + Polly + User-Agent
    TpexBondIssuanceApiClient.cs   // ITpexBondIssuanceApiClient — conversion terms (#11406)
    TpexBondQuoteApiClient.cs      // ITpexBondQuoteApiClient — daily bond prices
    TpexApiOptions.cs              // BaseUrl, UserAgent
    Models/                        // raw JSON DTOs for TPEx responses
  Twse/
    TwseHttpPipeline.cs            // AddTwseHttpClients()
    TwseStockQuoteApiClient.cs     // ITwseStockQuoteApiClient — underlying stock prices
    TwseApiOptions.cs
    Models/
Gateways/
  MarketDataProvider.cs            // : IMarketDataProvider — composes the 3 clients, maps raw -> Domain
Persistence/
  AppDbContext.cs                  // + DbSet<ConvertibleBond>, entity config in OnModelCreating
  ConvertibleBondRepository.cs     // : IConvertibleBondRepository (uses IDbContextFactory)
DependencyInjection.cs             // AddInfrastructure(): register clients, gateway, repository
```

- Each `ApiClient` is a thin primary-ctor class: public methods are try/catch
  wrappers (rethrow `OperationCanceledException`; log + rethrow otherwise); a
  private `SendAndDeserializeAsync` does GET → status check →
  `EnsureSuccessStatusCode` → `JsonSerializer.Deserialize`.
- `HttpPipeline` registers a **typed `HttpClient`** via
  `AddHttpClient<TInterface, TImpl>` with a **Polly resilience handler** (retry,
  exponential backoff + jitter; handles 5xx / 429 / 408 / transient exceptions),
  and sets `BaseAddress` + `User-Agent` from `IOptions<XxxApiOptions>`.
- Clients return **raw API models** only. Mapping to Domain happens in
  `MarketDataProvider`, keeping messy JSON shapes out of Domain.
- Persistence reuses the existing `AddDbContextFactory<AppDbContext>` +
  `IDbContextFactory` pattern (consistent with `UserRepository`).

### 5.3 Application (`AppName.Application`) — orchestration

```
UseCases/Bonds/
  RefreshBondDataUseCase.cs        // pull via IMarketDataProvider -> UpsertAsync into local DB
  GetConversionValuationUseCase.cs // read DB -> run Domain math -> ConversionValuationDto
Dtos/
  ConversionValuationDto.cs        // record: symbol, shares, value, bond price, isInTheMoney, asOf
DependencyInjection.cs             // register the two use cases (AddTransient)
```

## 6. Data flow

```
UI (read)    -> GetConversionValuationUseCase -> IConvertibleBondRepository (SQLite)
                                                    ^ seeded by v
UI (refresh) -> RefreshBondDataUseCase -> IMarketDataProvider -> Tpex/Twse ApiClients -> HTTP open data
```

- **Refresh** is an explicit action: pull terms + bond price + stock price,
  upsert the `ConvertibleBond` (+ latest prices) into SQLite.
- **Read/valuate** runs the pure Domain math over whatever is cached locally, so
  the app works offline after a refresh.
- **Manual seed** is a fallback path on the repository for bonds the feed misses.

## 7. Error handling

- Network/transient faults: Polly retry in the HTTP pipeline; exhausted retries
  surface as a logged exception from the client.
- Non-success HTTP: logged warning + `EnsureSuccessStatusCode` throws; the
  gateway decides whether a missing source is fatal or skippable per bond.
- Deserialization failure: throw `InvalidOperationException` (cannot map → cannot
  trust data).
- A refresh that fails for one bond must not abort the whole batch — log and
  continue, report a per-bond result summary.
- Division-by-zero guard: `ConversionValuation` rejects a zero/negative
  conversion price.

## 8. Testing

- **Domain.Tests** — `ConversionValuation` math exhaustively (incl. zero/negative
  conversion price, in-the-money boundary). Pure, no network.
- **Infrastructure.Tests** — each `ApiClient` against canned JSON via a mocked
  `HttpMessageHandler`; `ConvertibleBondRepository` against SQLite; mapping in
  `MarketDataProvider` with fake clients.
- **Application.Tests** — both use cases with a fake `IMarketDataProvider` and a
  fake repository.

## 9. New dependencies

Add to `Directory.Packages.props`:
- `Microsoft.Extensions.Http` (typed `HttpClient` / `AddHttpClient`)
- `Microsoft.Extensions.Http.Resilience` **or** `Polly` (resilience handler —
  match the SoleCore reference, which uses Polly's `AddResilienceHandler`)
- `Microsoft.Extensions.Options` (Options pattern)

## 10. Implementation subtasks (for decomposition)

1. Domain: entities (`ConvertibleBond`, `BondQuote`, `StockQuote`) +
   `ConversionValuation` value object + Domain.Tests.
2. Domain: `IMarketDataProvider` + `IConvertibleBondRepository` ports.
3. Infra: TPEx issuance client (pipeline + client + options + models +
   Infra.Tests).
4. Infra: TPEx bond-quote client.
5. Infra: TWSE stock-quote client.
6. Infra: `MarketDataProvider` gateway (raw → Domain mapping).
7. Infra: EF `ConvertibleBond` config + repository + migration.
8. Application: `RefreshBondDataUseCase` + `GetConversionValuationUseCase` +
   `ConversionValuationDto` + App.Tests.
9. Wiring: DI registration across layers + add NuGet packages.

Each subtask has a clear interface boundary and its own tests, suitable for
independent (sub)agent implementation.
