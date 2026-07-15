using AppName.Infrastructure.Clients.Twse.Models;

namespace AppName.Infrastructure.Clients.Twse;

/// <summary>
/// Raw HTTP access to TWSE daily stock closing prices.
/// </summary>
public interface ITwseStockQuoteApiClient
{
    /// <summary>
    /// Fetches all daily stock quotes (raw shapes, no domain mapping).
    /// </summary>
    Task<IReadOnlyList<TwseStockQuoteRecord>> GetAllAsync(CancellationToken ct = default);
}
