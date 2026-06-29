using AppName.Application.Dtos;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;

namespace AppName.Application.UseCases.Users;

public sealed class AddUserUseCase
{
    private readonly IUserRepository _repo;
    public AddUserUseCase(IUserRepository repo) => _repo = repo;

    public async Task<UserDto> ExecuteAsync(string name, string email, CancellationToken ct = default)
    {
        var user = new User(Guid.NewGuid(), name, email);
        await _repo.AddAsync(user, ct);
        return new UserDto(user.Id, user.Name, user.Email);
    }
}
