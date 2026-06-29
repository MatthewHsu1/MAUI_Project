using AppName.Domain.Entities;
using AppName.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests;

public class UserRepositoryTests
{
    private static AppDbContext NewContext(string dbPath)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;
        var ctx = new AppDbContext(options);
        ctx.Database.EnsureCreated();
        return ctx;
    }

    [Fact]
    public async Task AddAsync_ThenGetAllAsync_ReturnsPersistedUser()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.db");
        try
        {
            await using var ctx = NewContext(dbPath);
            var repo = new UserRepository(ctx);

            await repo.AddAsync(new User(Guid.NewGuid(), "Ada", "ada@x.com"));
            var all = await repo.GetAllAsync();

            var user = Assert.Single(all);
            Assert.Equal("Ada", user.Name);
        }
        finally
        {
            if (File.Exists(dbPath)) File.Delete(dbPath);
        }
    }
}
