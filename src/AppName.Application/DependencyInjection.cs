using AppName.Application.UseCases.Users;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddTransient<GetUsersUseCase>();
        services.AddTransient<AddUserUseCase>();
        return services;
    }
}
