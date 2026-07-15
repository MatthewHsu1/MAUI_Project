using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Maui;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();

        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
            });

        // MAUI has no filesystem appsettings; the JSON is embedded and read
        // as a manifest resource stream. There is no ASPNETCORE_ENVIRONMENT
        // either, so #if DEBUG selects the Development layer.
        var assembly = Assembly.GetExecutingAssembly();

        using (var stream = assembly.GetManifestResourceStream("AppName.Maui.appsettings.json"))
        {
            if (stream is not null)
            {
                builder.Configuration.AddJsonStream(stream);
            }
        }

#if DEBUG
        using (var stream = assembly.GetManifestResourceStream("AppName.Maui.appsettings.Development.json"))
        {
            if (stream is not null)
            {
                builder.Configuration.AddJsonStream(stream);
            }
        }
#endif

        builder.Services.AddAppServices(builder.Configuration);

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
