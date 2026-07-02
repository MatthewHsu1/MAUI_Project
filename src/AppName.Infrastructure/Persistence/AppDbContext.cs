using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<ConvertibleBond> ConvertibleBonds => Set<ConvertibleBond>();

    public DbSet<BondValuationSnapshot> BondValuationSnapshots => Set<BondValuationSnapshot>();

    public DbSet<BondValuationRefreshState> BondValuationRefreshStates => Set<BondValuationRefreshState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var bond = modelBuilder.Entity<ConvertibleBond>();
        bond.HasKey(b => b.Symbol);
        bond.Property(b => b.Symbol).IsRequired();
        bond.Property(b => b.Name).IsRequired();
        bond.Property(b => b.ParValue);
        bond.Property(b => b.ConversionPrice);
        bond.Property(b => b.UnderlyingSymbol).IsRequired();

        var snapshot = modelBuilder.Entity<BondValuationSnapshot>();
        snapshot.HasKey(s => s.Symbol);
        snapshot.Property(s => s.Symbol).IsRequired();

        var bondValuationRefreshState = modelBuilder.Entity<BondValuationRefreshState>();
        bondValuationRefreshState.HasKey(r => r.Id);
        bondValuationRefreshState.Property(r => r.Id).ValueGeneratedNever();
    }
}
