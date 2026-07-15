namespace AppName.Application.UseCases.Bonds;

/// <summary>
/// Discovers all active convertible bonds, pulls their daily quotes, and caches
/// a valuation snapshot for each, stamping the refresh marker.
/// </summary>
public interface IRefreshAllBondsUseCase
{
    /// <summary>
    /// Runs a full whole-market refresh. Best-effort per bond: a bond without a
    /// usable stock quote is skipped rather than failing the whole refresh.
    /// </summary>
    Task ExecuteAsync(CancellationToken ct = default);
}
