using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

public sealed class UserRepository : IUserRepository
{
    private readonly IDbContextFactory<AppDbContext> _factory;
    public UserRepository(IDbContextFactory<AppDbContext> factory) => _factory = factory;

    public async Task AddAsync(User user, CancellationToken ct = default)
    {
        await using var db = _factory.CreateDbContext();
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default)
    {
        await using var db = _factory.CreateDbContext();
        return await db.Users.AsNoTracking().ToListAsync(ct);
    }
}
