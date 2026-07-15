namespace AppName.Maui.Bridge;

/// <summary>
/// Marker for a feature bridge whose public methods are invokable from
/// JavaScript via the MAUI HybridWebView. Implementations are auto-registered
/// in DI and composed onto the single <see cref="AppBridge"/> invoke target.
/// </summary>
public interface IWebBridge
{
}
