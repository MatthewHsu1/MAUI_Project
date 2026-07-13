using AppName.Application.Dtos;

namespace AppName.Maui.Bridge;

/// <summary>
/// The single object set as the HybridWebView invoke target. JavaScript resolves
/// calls by bare method name against this instance, so every JS-callable method
/// is surfaced here and delegated to the owning feature bridge. Method names must
/// stay globally unique across features.
/// </summary>
public sealed class AppBridge(BondsBridge bonds)
{
    /// <summary>
    /// Returns today's conversion valuation for every cached convertible bond.
    /// </summary>
    public Task<IReadOnlyList<ConversionValuationDto>> GetValuations() => bonds.GetValuations();
}
