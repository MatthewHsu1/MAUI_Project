using System.Text.Json;
using AppName.Infrastructure.Clients.TwseMis.Models;

namespace AppName.Infrastructure.Clients.TwseMis;

/// <inheritdoc/>
public sealed class TwseMisBondQuoteApiClient(HttpClient httpClient) : ITwseMisBondQuoteApiClient
{
    private const string Path = "getStockInfo.jsp";

    private const int ChunkSize = 50;

    /// <inheritdoc/>
    public async Task<IReadOnlyList<TwseMisQuoteRecord>> GetQuotesAsync(IEnumerable<string> bondCodes, CancellationToken ct = default)
    {
        var codes = bondCodes.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList();

        var results = new List<TwseMisQuoteRecord>();

        try
        {
            foreach (var chunk in codes.Chunk(ChunkSize))
            {
                // "%7C" is the percent-encoded pipe MIS expects between channels.
                var exCh = string.Join("%7C", chunk.Select(c => $"otc_{c}.tw"));
                var url = $"{Path}?ex_ch={exCh}&json=1&delay=0";

                using var response = await httpClient.GetAsync(url, ct);
                response.EnsureSuccessStatusCode();

                using var stream = await response.Content.ReadAsStreamAsync(ct);

                var payload = await JsonSerializer.DeserializeAsync<TwseMisResponse>(stream, cancellationToken: ct)
                    ?? throw new InvalidOperationException("Failed to deserialize TWSE MIS response.");

                if (payload.MsgArray is { Count: > 0 })
                {
                    results.AddRange(payload.MsgArray.Where(r => !string.IsNullOrEmpty(r.Code)));
                }
            }

            return results;
        }
        catch (OperationCanceledException) { throw; }
    }
}
