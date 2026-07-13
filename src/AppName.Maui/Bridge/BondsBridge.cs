using AppName.Application.Dtos;
using AppName.Maui.Services;

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
