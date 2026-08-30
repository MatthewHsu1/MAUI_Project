using AppName.Application.Dtos.Bonds;
using AppName.Maui.Clients.Bonds;

namespace AppName.Maui.Bridge;

/// <summary>
/// Methods on this object are invoked from JavaScript via HybridWebView.
/// </summary>
public sealed class BondsBridge(IBondsApiClient bondsApiClient) : IWebBridge
{
    /// <summary>
    /// Returns today's conversion valuation for every cached convertible bond.
    /// </summary>
    public Task<IReadOnlyList<ConversionValuationDto>> GetValuations() => bondsApiClient.GetValuationsAsync();
}
