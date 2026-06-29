using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

public sealed class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;
    public UserRepository(AppDbContext db) => _db = db;

    public async Task AddAsync(User user, CancellationToken ct = default)
    {
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default)
        => await _db.Users.AsNoTracking().ToListAsync(ct);
}
