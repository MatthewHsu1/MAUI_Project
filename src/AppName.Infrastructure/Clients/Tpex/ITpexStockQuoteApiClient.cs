using AppName.Infrastructure.Clients.Tpex.Models;

namespace AppName.Infrastructure.Clients.Tpex;

/// <summary>
/// Raw HTTP access to TPEx OTC daily stock closing prices.
/// </summary>
public interface ITpexStockQuoteApiClient
{
    /// <summary>
    /// Fetches all OTC daily stock quotes (raw shapes, no domain mapping).
    /// </summary>
    Task<IReadOnlyList<TpexStockQuoteRecord>> GetAllAsync(CancellationToken ct = default);
}
