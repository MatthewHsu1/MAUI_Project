using System.Net;
using System.Text;
using AppName.Infrastructure.Clients.TwseMis;

namespace AppName.Infrastructure.Tests.Clients.TwseMis;

public class TwseMisBondQuoteApiClientTests
{
    private sealed class CapturingHandler(string body) : HttpMessageHandler
    {
        public List<Uri> Requests { get; } = new();

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add(request.RequestUri!);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }

    private sealed class Fixture : IDisposable
    {
        private HttpClient? _http;

        public string ResponseBody { get; private set; } = "{\"rtcode\":\"0000\",\"msgArray\":[]}";

        public CapturingHandler? Handler { get; private set; }

        public Fixture WithResponse(string body)
        {
            ResponseBody = body;
            return this;
        }

        public TwseMisBondQuoteApiClient Build()
        {
            Handler = new CapturingHandler(ResponseBody);
            _http = new HttpClient(Handler) { BaseAddress = new Uri("https://mis.example.test/stock/api/") };
            return new TwseMisBondQuoteApiClient(_http);
        }

        public void Dispose() => _http?.Dispose();
    }

    [Fact]
    public async Task GetQuotesAsync_DeserializesEnvelopeRecords()
    {
        var json = await File.ReadAllTextAsync("Clients/TwseMis/Fixtures/mis-cb-quote.json");
        using var fx = new Fixture().WithResponse(json);

        var quotes = await fx.Build().GetQuotesAsync(new[] { "11011", "12561" });

        Assert.Equal(2, quotes.Count);

        var taicement = Assert.Single(quotes, q => q.Code == "11011");
        Assert.Equal("-", taicement.LastPrice);
        Assert.Equal("100.0000", taicement.PreviousClose);
        Assert.Equal("20260702", taicement.Date);

        var fruit = Assert.Single(quotes, q => q.Code == "12561");
        Assert.Equal("103.5000", fruit.LastPrice);
    }

    [Fact]
    public async Task GetQuotesAsync_BatchesCodesIntoOneOtcRequest()
    {
        using var fx = new Fixture();
        var client = fx.Build();

        await client.GetQuotesAsync(new[] { "11011", "12561" });

        var request = Assert.Single(fx.Handler!.Requests);
        var url = request.ToString();
        Assert.Contains("getStockInfo.jsp", url);
        Assert.Contains("otc_11011.tw", url);
        Assert.Contains("otc_12561.tw", url);
        Assert.Contains("json=1", url);
    }
}
