using AppName.Application.UseCases.Bonds;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddTransient<RefreshBondDataUseCase>();
        services.AddTransient<GetConversionValuationUseCase>();
        return services;
    }
}
