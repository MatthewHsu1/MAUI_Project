using AppName.Infrastructure.Clients.TwseMis.Models;

namespace AppName.Infrastructure.Clients.TwseMis;

/// <summary>
/// Fetches live convertible-bond quotes from the TWSE MIS service (mis.twse.com.tw).
/// </summary>
public interface ITwseMisBondQuoteApiClient
{
    /// <summary>
    /// Gets the current quote records for the given bond codes. Codes are queried
    /// on the OTC channel and batched into as few requests as possible; the result
    /// contains only records the service returned (missing codes are omitted).
    /// </summary>
    Task<IReadOnlyList<TwseMisQuoteRecord>> GetQuotesAsync(IEnumerable<string> bondCodes, CancellationToken ct = default);
}
