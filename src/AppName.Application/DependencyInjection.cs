using AppName.Application.UseCases.Bonds;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddTransient<RefreshBondDataUseCase>();
        services.AddTransient<GetConversionValuationUseCase>();
        services.AddTransient<IRefreshAllBondsUseCase, RefreshAllBondsUseCase>();
        return services;
    }
}
