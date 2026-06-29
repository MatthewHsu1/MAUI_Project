using AppName.Application.Dtos;
using AppName.Domain.Abstractions;

namespace AppName.Application.UseCases.Users;

public sealed class GetUsersUseCase
{
    private readonly IUserRepository _repo;
    public GetUsersUseCase(IUserRepository repo) => _repo = repo;

    public async Task<IReadOnlyList<UserDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var users = await _repo.GetAllAsync(ct);
        return users.Select(u => new UserDto(u.Id, u.Name, u.Email)).ToList();
    }
}
