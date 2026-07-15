using System.Net;
using System.Text;
using AppName.Infrastructure.Clients.Tpex;

namespace AppName.Infrastructure.Tests.Clients.Tpex;

public class TpexBondIssuanceApiClientTests
{
    private sealed class StubHandler(string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }

    private sealed class Fixture : IDisposable
    {
        private HttpClient? _http;

        public string ResponseBody { get; private set; } = "[]";

        public Fixture WithResponse(string body)
        {
            ResponseBody = body;
            return this;
        }

        public TpexBondIssuanceApiClient Build()
        {
            _http = new HttpClient(new StubHandler(ResponseBody)) { BaseAddress = new Uri("https://example.test/") };
            return new TpexBondIssuanceApiClient(_http);
        }

        public void Dispose() => _http?.Dispose();
    }

    [Fact]
    public async Task GetAllAsync_DeserializesRecords_IncludingSlashKey()
    {
        var json = await File.ReadAllTextAsync("Clients/Tpex/Fixtures/bond-issuance.json");
        using var fx = new Fixture().WithResponse(json);

        var records = await fx.Build().GetAllAsync();

        var taicement = Assert.Single(records, r => r.BondCode == "11011");
        Assert.Equal("1101", taicement.IssuerCode);
        Assert.Equal("36.5000", taicement.ConversionPriceAtIssuance);
        Assert.Equal("台泥一永", taicement.ShortName);

        Assert.Equal(2, records.Count);
        var freshJuice = Assert.Single(records, r => r.BondCode == "12561");
        Assert.Equal("鮮活果汁一KY", freshJuice.ShortName);
        Assert.Equal("1256", freshJuice.IssuerCode);
        Assert.Equal("190.0000", freshJuice.ConversionPriceAtIssuance);
    }
}
