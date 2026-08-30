using AppName.Domain.Abstractions.Bonds;
using AppName.Domain.Abstractions.MarketData;

namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Pulls a bond's terms from the market-data provider and caches them
/// locally.
/// </summary>
public sealed class RefreshBondDataUseCase(IMarketDataProvider provider, IConvertibleBondRepository repo)
{
    /// <summary>
    /// Fetches issuance terms for the bond and upserts them. No-op if the
    /// provider has no record.
    /// </summary>
    public async Task ExecuteAsync(string bondSymbol, CancellationToken ct = default)
    {
        var terms = await provider.GetIssuanceTermsAsync(bondSymbol, ct);

        if (terms is null) return;

        await repo.UpsertAsync(terms, ct);
    }
}
