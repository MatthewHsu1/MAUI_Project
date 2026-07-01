using System.Net;
using System.Text;
using AppName.Infrastructure.Clients.Tpex;

namespace AppName.Infrastructure.Tests.Clients.Tpex;

public class TpexStockQuoteApiClientTests
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

        public TpexStockQuoteApiClient Build()
        {
            _http = new HttpClient(new StubHandler(ResponseBody)) { BaseAddress = new Uri("https://example.test/") };
            return new TpexStockQuoteApiClient(_http);
        }

        public void Dispose() => _http?.Dispose();
    }

    [Fact]
    public async Task GetAllAsync_DeserializesOtcQuotes()
    {
        var json = await File.ReadAllTextAsync("Clients/Tpex/Fixtures/otc-stock-quote.json");
        using var fx = new Fixture().WithResponse(json);

        var quotes = await fx.Build().GetAllAsync();

        var gws = Assert.Single(quotes, q => q.SecuritiesCompanyCode == "6488");
        Assert.Equal("500.00", gws.Close);

        Assert.Equal(2, quotes.Count);
        var sas = Assert.Single(quotes, q => q.SecuritiesCompanyCode == "5483");
        Assert.Equal("210.50", sas.Close);
    }
}
