using AppName.Domain.Entities;
using AppName.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests;

public class UserRepositoryTests
{
    private sealed class TestDbContextFactory : IDbContextFactory<AppDbContext>
    {
        private readonly DbContextOptions<AppDbContext> _options;
        public TestDbContextFactory(string dbPath)
            => _options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite($"Data Source={dbPath}").Options;
        public AppDbContext CreateDbContext() => new AppDbContext(_options);
    }

    [Fact]
    public async Task AddAsync_ThenGetAllAsync_ReturnsPersistedUser()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.db");
        try
        {
            var factory = new TestDbContextFactory(dbPath);

            using (var ctx = factory.CreateDbContext())
                ctx.Database.EnsureCreated();

            var repo = new UserRepository(factory);

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
