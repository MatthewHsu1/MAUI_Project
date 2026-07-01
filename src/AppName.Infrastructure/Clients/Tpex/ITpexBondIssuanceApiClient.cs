using AppName.Infrastructure.Clients.Tpex.Models;

namespace AppName.Infrastructure.Clients.Tpex;

/// <summary>
/// Raw HTTP access to the TPEx convertible-bond issuance dataset.
/// </summary>
public interface ITpexBondIssuanceApiClient
{
    /// <summary>
    /// Fetches all issuance records (raw shapes, no domain mapping).
    /// </summary>
    Task<IReadOnlyList<TpexBondIssuanceRecord>> GetAllAsync(CancellationToken ct = default);
}
