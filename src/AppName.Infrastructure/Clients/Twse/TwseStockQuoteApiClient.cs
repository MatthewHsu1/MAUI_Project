using System.Text.Json;
using AppName.Infrastructure.Clients.Twse.Models;

namespace AppName.Infrastructure.Clients.Twse;

/// <inheritdoc/>
public sealed class TwseStockQuoteApiClient(HttpClient httpClient) : ITwseStockQuoteApiClient
{
    private const string Path = "exchangeReport/STOCK_DAY_ALL";

    /// <inheritdoc/>
    public async Task<IReadOnlyList<TwseStockQuoteRecord>> GetAllAsync(CancellationToken ct = default)
    {
        try
        {
            using var response = await httpClient.GetAsync(Path, ct);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync(ct);

            return await JsonSerializer.DeserializeAsync<List<TwseStockQuoteRecord>>(stream, cancellationToken: ct)
                ?? throw new InvalidOperationException("Failed to deserialize TWSE stock-quote response.");
        }
        catch (OperationCanceledException) { throw; }
    }
}
