using AppName.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

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

        var dbPath = Path.Combine(FileSystem.AppDataDirectory, "app.db");

        builder.Services.AddAppServices(dbPath);

#if DEBUG
        builder.Logging.AddDebug();
#endif

        var app = builder.Build();

        using (var db = app.Services.GetRequiredService<IDbContextFactory<AppDbContext>>().CreateDbContext())
        {
            db.Database.Migrate();
        }

        return app;
    }
}
