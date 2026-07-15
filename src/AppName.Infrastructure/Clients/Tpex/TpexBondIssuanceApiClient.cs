using System.Text.Json;
using AppName.Infrastructure.Clients.Tpex.Models;

namespace AppName.Infrastructure.Clients.Tpex;

/// <inheritdoc/>
public sealed class TpexBondIssuanceApiClient(HttpClient httpClient) : ITpexBondIssuanceApiClient
{
    private const string Path = "bond_ISSBD5_data";

    /// <inheritdoc/>
    public async Task<IReadOnlyList<TpexBondIssuanceRecord>> GetAllAsync(CancellationToken ct = default)
    {
        try
        {
            using var response = await httpClient.GetAsync(Path, ct);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync(ct);

            return await JsonSerializer.DeserializeAsync<List<TpexBondIssuanceRecord>>(stream, cancellationToken: ct)
                ?? throw new InvalidOperationException("Failed to deserialize TPEx issuance response.");
        }
        catch (OperationCanceledException) { throw; }
    }
}
