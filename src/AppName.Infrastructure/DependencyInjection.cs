using AppName.Domain.Abstractions;
using AppName.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string dbPath)
    {
        services.AddDbContext<AppDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));
        services.AddScoped<IUserRepository, UserRepository>();
        return services;
    }
}
