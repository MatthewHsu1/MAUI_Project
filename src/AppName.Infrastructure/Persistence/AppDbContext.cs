using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<ConvertibleBond> ConvertibleBonds => Set<ConvertibleBond>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var bond = modelBuilder.Entity<ConvertibleBond>();
        bond.HasKey(b => b.Symbol);
        bond.Property(b => b.Symbol).IsRequired();
        bond.Property(b => b.Name).IsRequired();
        bond.Property(b => b.ParValue);
        bond.Property(b => b.ConversionPrice);
        bond.Property(b => b.UnderlyingSymbol).IsRequired();
    }
}
