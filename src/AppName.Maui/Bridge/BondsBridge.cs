using AppName.Application.Dtos;
using AppName.Application.UseCases.Bonds;

namespace AppName.Maui.Bridge;

/// <summary>
/// Methods on this object are invoked from JavaScript via HybridWebView.
/// </summary>
public sealed class BondsBridge(GetValuationsUseCase getValuations) : IWebBridge
{
    /// <summary>
    /// Returns today's conversion valuation for every cached convertible bond.
    /// </summary>
    public Task<IReadOnlyList<ConversionValuationDto>> GetValuations() => getValuations.ExecuteAsync();
}
