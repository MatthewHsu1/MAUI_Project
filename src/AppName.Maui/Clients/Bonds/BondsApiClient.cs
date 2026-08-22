using System.Net.Http.Json;
using AppName.Application.Dtos.Bonds;

namespace AppName.Maui.Clients.Bonds;

/// <inheritdoc/>
public sealed class BondsApiClient(HttpClient httpClient) : IBondsApiClient
{
    /// <inheritdoc/>
    public async Task<IReadOnlyList<ConversionValuationDto>> GetValuationsAsync(CancellationToken ct = default)
    {
        var valuations = await httpClient.GetFromJsonAsync<List<ConversionValuationDto>>("valuations", ct);

        return valuations ?? [];
    }
}
