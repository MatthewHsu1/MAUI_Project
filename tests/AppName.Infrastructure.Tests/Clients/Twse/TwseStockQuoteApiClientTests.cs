using System.Net;
using System.Text;
using AppName.Infrastructure.Clients.Twse;

namespace AppName.Infrastructure.Tests.Clients.Twse;

public class TwseStockQuoteApiClientTests
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

        public TwseStockQuoteApiClient Build()
        {
            _http = new HttpClient(new StubHandler(ResponseBody)) { BaseAddress = new Uri("https://example.test/") };
            return new TwseStockQuoteApiClient(_http);
        }

        public void Dispose() => _http?.Dispose();
    }

    [Fact]
    public async Task GetAllAsync_DeserializesQuotes()
    {
        var json = await File.ReadAllTextAsync("Clients/Twse/Fixtures/stock-quote.json");
        using var fx = new Fixture().WithResponse(json);

        var quotes = await fx.Build().GetAllAsync();

        var cement = Assert.Single(quotes, q => q.Code == "1101");
        Assert.Equal("36.80", cement.ClosingPrice);
        Assert.Equal("1150629", cement.Date);

        Assert.Equal(2, quotes.Count);
        var tsmc = Assert.Single(quotes, q => q.Code == "2330");
        Assert.Equal("1085.00", tsmc.ClosingPrice);
    }
}
