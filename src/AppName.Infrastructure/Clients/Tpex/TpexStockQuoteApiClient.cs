using System.Text.Json;
using AppName.Infrastructure.Clients.Tpex.Models;

namespace AppName.Infrastructure.Clients.Tpex;

/// <inheritdoc/>
public sealed class TpexStockQuoteApiClient(HttpClient httpClient) : ITpexStockQuoteApiClient
{
    private const string Path = "tpex_mainboard_quotes";

    /// <inheritdoc/>
    public async Task<IReadOnlyList<TpexStockQuoteRecord>> GetAllAsync(CancellationToken ct = default)
    {
        try
        {
            using var response = await httpClient.GetAsync(Path, ct);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync(ct);

            return await JsonSerializer.DeserializeAsync<List<TpexStockQuoteRecord>>(stream, cancellationToken: ct)
                ?? throw new InvalidOperationException("Failed to deserialize TPEx OTC stock-quote response.");
        }
        catch (OperationCanceledException) { throw; }
    }
}
