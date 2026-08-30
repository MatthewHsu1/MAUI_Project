using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Migrations.Internal;

namespace AppName.Infrastructure.Persistence.Context;

// EF1001: NpgsqlHistoryRepository lives in the provider's ...Migrations.Internal namespace and is
// marked as an internal API. Subclassing it is the only supported way to change the migration lock
// (see the class summary), so the warning is suppressed deliberately and this file should be
// re-checked whenever the Npgsql provider is upgraded across a major version.
#pragma warning disable EF1001

/// <summary>
/// An <see cref="IHistoryRepository"/> for YugabyteDB that skips EF Core's migration lock.
/// </summary>
/// <remarks>
/// EF Core 9 added a migration lock, which the Npgsql provider takes out by issuing
/// <c>LOCK TABLE "__EFMigrationsHistory" IN ACCESS EXCLUSIVE MODE</c>. YugabyteDB does not implement
/// explicit table locks and rejects every lock mode with <c>0A000: ... not supported yet</c>, so
/// migrations fail before any SQL is applied. Overriding the lock to a no-op is the workaround
/// recommended by the EF/Npgsql maintainers for PostgreSQL-compatible databases
/// (see https://github.com/dotnet/efcore/issues/33731 and https://github.com/npgsql/npgsql/issues/6025).
/// <para>
/// The trade-off: nothing prevents two migrators from running against the database concurrently.
/// That protection is what the lock provided. YugabyteDB gained table-lock support behind the
/// preview <c>enable_object_locking_for_table_locks</c> gflag (yugabyte-db#5384); once that is
/// enabled on the cluster, this class can be removed in favour of the provider's default.
/// </para>
/// </remarks>
public sealed class YugabyteHistoryRepository(HistoryRepositoryDependencies dependencies)
    : NpgsqlHistoryRepository(dependencies)
{
    /// <inheritdoc/>
    public override IMigrationsDatabaseLock AcquireDatabaseLock()
        => new NoopMigrationsDatabaseLock(this);

    /// <inheritdoc/>
    public override Task<IMigrationsDatabaseLock> AcquireDatabaseLockAsync(
        CancellationToken cancellationToken = default)
        => Task.FromResult<IMigrationsDatabaseLock>(new NoopMigrationsDatabaseLock(this));

    /// <summary>
    /// A migration lock handle that holds no database lock and releases nothing on disposal.
    /// </summary>
    private sealed class NoopMigrationsDatabaseLock(IHistoryRepository historyRepository) : IMigrationsDatabaseLock
    {
        /// <inheritdoc/>
        public IHistoryRepository HistoryRepository => historyRepository;

        /// <inheritdoc/>
        public void Dispose()
        {
        }

        /// <inheritdoc/>
        public ValueTask DisposeAsync() => default;
    }
}

#pragma warning restore EF1001
