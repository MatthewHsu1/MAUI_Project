using AppName.Infrastructure.Clients.Tpex;
using AppName.Infrastructure.Clients.Tpex.Models;
using AppName.Infrastructure.Clients.Twse;
using AppName.Infrastructure.Clients.Twse.Models;
using AppName.Infrastructure.Clients.TwseMis;
using AppName.Infrastructure.Clients.TwseMis.Models;
using AppName.Infrastructure.Gateways;

namespace AppName.Infrastructure.Tests.Gateways;

public class MarketDataProviderTests
{
    private sealed class Fixture
    {
        public Mock<ITpexBondIssuanceApiClient> Issuance { get; } = new();

        public Mock<ITwseStockQuoteApiClient> Twse { get; } = new();
        
        public Mock<ITpexStockQuoteApiClient> TpexStock { get; } = new();

        public Mock<ITwseMisBondQuoteApiClient> Mis { get; } = new();

        public Fixture()
        {
            // Default baseline: every source returns an empty list (the "nothing found" case).
            Issuance.Setup(c => c.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(Array.Empty<TpexBondIssuanceRecord>());
            Twse.Setup(c => c.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(Array.Empty<TwseStockQuoteRecord>());
            TpexStock.Setup(c => c.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(Array.Empty<TpexStockQuoteRecord>());
            Mis.Setup(c => c.GetQuotesAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<TwseMisQuoteRecord>());
        }

        public Fixture WithIssuance(params TpexBondIssuanceRecord[] records)
        {
            Issuance.Setup(c => c.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(records);
            return this;
        }

        public Fixture WithTwse(params TwseStockQuoteRecord[] records)
        {
            Twse.Setup(c => c.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(records);
            return this;
        }

        public Fixture WithTpexOtc(params TpexStockQuoteRecord[] records)
        {
            TpexStock.Setup(c => c.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(records);
            return this;
        }

        public Fixture WithMisQuotes(params TwseMisQuoteRecord[] records)
        {
            Mis.Setup(c => c.GetQuotesAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(records);
            return this;
        }

        public MarketDataProvider Build() => new(Issuance.Object, Twse.Object, TpexStock.Object, Mis.Object);
    }

    [Fact]
    public async Task GetIssuanceTermsAsync_MapsRawToDomain_WithParConventionAndUnderlying()
    {
        var fx = new Fixture().WithIssuance(new TpexBondIssuanceRecord
        { BondCode = "11011", ShortName = "台泥一永", IssuerCode = "1101", ConversionPriceAtIssuance = "36.5000" });

        var bond = await fx.Build().GetIssuanceTermsAsync("11011");

        Assert.NotNull(bond);
        Assert.Equal(36.5m, bond!.ConversionPrice);
        Assert.Equal("1101", bond.UnderlyingSymbol);
        Assert.Equal(100_000m, bond.ParValue);
    }

    [Fact]
    public async Task GetIssuanceTermsAsync_ReturnsNull_WhenMissing()
        => Assert.Null(await new Fixture().Build().GetIssuanceTermsAsync("9999"));

    [Fact]
    public async Task GetIssuanceTermsAsync_ReturnsNull_WhenConversionPriceUnparseable()
    {
        var fx = new Fixture().WithIssuance(new TpexBondIssuanceRecord
        { BondCode = "11011", ShortName = "台泥一永", IssuerCode = "1101", ConversionPriceAtIssuance = "-" });

        var bond = await fx.Build().GetIssuanceTermsAsync("11011");

        Assert.Null(bond);
    }

    [Fact]
    public async Task GetStockQuoteAsync_PrefersTwse_AndParsesRocDate()
    {
        var fx = new Fixture().WithTwse(new TwseStockQuoteRecord { Code = "1101", ClosingPrice = "36.80", Date = "1150629" });

        var q = await fx.Build().GetStockQuoteAsync("1101");

        Assert.Equal(36.80m, q!.Price);
        Assert.Equal(new DateOnly(2026, 6, 29), q.AsOf);
    }

    [Fact]
    public async Task GetStockQuoteAsync_FallsBackToTpex_WhenNotOnTwse()
    {
        var fx = new Fixture().WithTpexOtc(new TpexStockQuoteRecord { SecuritiesCompanyCode = "6488", Close = "500.00", Date = "1150630" });

        var q = await fx.Build().GetStockQuoteAsync("6488");

        Assert.Equal(500.00m, q!.Price);
        Assert.Equal(new DateOnly(2026, 6, 30), q.AsOf);
    }

    [Fact]
    public async Task GetStockQuoteAsync_ReturnsNull_WhenOnNeitherSource()
        => Assert.Null(await new Fixture().Build().GetStockQuoteAsync("9999"));

    [Theory]
    [InlineData("")]
    [InlineData("bad")]
    public async Task GetStockQuoteAsync_FallsBackToTpex_WhenTwseDateMalformed(string malformedDate)
    {
        var fx = new Fixture()
            .WithTwse(new TwseStockQuoteRecord { Code = "6488", ClosingPrice = "36.80", Date = malformedDate })
            .WithTpexOtc(new TpexStockQuoteRecord { SecuritiesCompanyCode = "6488", Close = "500.00", Date = "1150630" });

        var q = await fx.Build().GetStockQuoteAsync("6488");

        Assert.Equal(500.00m, q!.Price);
        Assert.Equal(new DateOnly(2026, 6, 30), q.AsOf);
    }

    [Theory]
    [InlineData("")]
    [InlineData("bad")]
    public async Task GetStockQuoteAsync_ReturnsNull_WhenOnlySourceHasMalformedDate(string malformedDate)
    {
        var fx = new Fixture()
            .WithTwse(new TwseStockQuoteRecord { Code = "1101", ClosingPrice = "36.80", Date = malformedDate });

        var q = await fx.Build().GetStockQuoteAsync("1101");

        Assert.Null(q);
    }

    [Fact]
    public async Task GetBondQuoteAsync_UsesLastPrice_ScaledToNtDollars()
    {
        var fx = new Fixture().WithMisQuotes(new TwseMisQuoteRecord
        { Code = "11011", LastPrice = "100.2000", PreviousClose = "100.0000", Date = "20260702" });

        var q = await fx.Build().GetBondQuoteAsync("11011");

        Assert.NotNull(q);
        Assert.Equal(100_200m, q!.Price);            // 100.20% of NT$100,000 par
        Assert.Equal(new DateOnly(2026, 7, 2), q.AsOf);
    }

    [Fact]
    public async Task GetBondQuoteAsync_FallsBackToPreviousClose_WhenLastPriceIsDash()
    {
        var fx = new Fixture().WithMisQuotes(new TwseMisQuoteRecord
        { Code = "11011", LastPrice = "-", PreviousClose = "100.0000", Date = "20260702" });

        var q = await fx.Build().GetBondQuoteAsync("11011");

        Assert.NotNull(q);
        Assert.Equal(100_000m, q!.Price);            // falls back to y = 100.00% of par
    }

    [Fact]
    public async Task GetBondQuoteAsync_ReturnsNull_WhenNoMatchingRecord()
        => Assert.Null(await new Fixture().Build().GetBondQuoteAsync("9999"));

    [Fact]
    public async Task GetBondQuoteAsync_ReturnsNull_WhenOnlyRecordIsForDifferentCode()
    {
        var fx = new Fixture().WithMisQuotes(new TwseMisQuoteRecord
        { Code = "22222", LastPrice = "100.0000", PreviousClose = "100.0000", Date = "20260702" });

        Assert.Null(await fx.Build().GetBondQuoteAsync("11011"));
    }

    [Fact]
    public async Task GetBondQuoteAsync_ReturnsNull_WhenNoUsablePrice()
    {
        var fx = new Fixture().WithMisQuotes(new TwseMisQuoteRecord
        { Code = "11011", LastPrice = "-", PreviousClose = "-", Date = "20260702" });

        Assert.Null(await fx.Build().GetBondQuoteAsync("11011"));
    }

    [Fact]
    public async Task GetBondQuoteAsync_ReturnsNull_WhenDateMalformed()
    {
        var fx = new Fixture().WithMisQuotes(new TwseMisQuoteRecord
        { Code = "11011", LastPrice = "100.2000", PreviousClose = "100.0000", Date = "bad" });

        Assert.Null(await fx.Build().GetBondQuoteAsync("11011"));
    }
}
