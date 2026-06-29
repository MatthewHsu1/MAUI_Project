using AppName.Application.UseCases.Users;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;

namespace AppName.Application.Tests;

public class GetUsersUseCaseTests
{
    private sealed class FakeUserRepository : IUserRepository
    {
        private readonly List<User> _users = new();
        public Task AddAsync(User user, CancellationToken ct = default)
        {
            _users.Add(user);
            return Task.CompletedTask;
        }
        public Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<User>>(_users);
    }

    [Fact]
    public async Task ExecuteAsync_MapsEntitiesToDtos()
    {
        var repo = new FakeUserRepository();
        await repo.AddAsync(new User(Guid.NewGuid(), "Ada", "ada@x.com"));
        var sut = new GetUsersUseCase(repo);

        var result = await sut.ExecuteAsync();

        var dto = Assert.Single(result);
        Assert.Equal("Ada", dto.Name);
        Assert.Equal("ada@x.com", dto.Email);
    }
}
