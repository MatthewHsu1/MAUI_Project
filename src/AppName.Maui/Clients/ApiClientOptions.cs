namespace AppName.Maui.Clients;

/// <summary>
/// Configuration for the AppName.Api HTTP clients.
/// </summary>
public sealed class ApiClientOptions
{
    /// <summary>
    /// Name of the configuration section this binds to.
    /// </summary>
    public const string SectionName = "Api";

    /// <summary>
    /// Base address of AppName.Api (expected to end in "/api/").
    /// </summary>
    public string BaseUrl { get; set; } = string.Empty;
}
