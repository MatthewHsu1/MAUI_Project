using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppName.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedBondValuationRefreshState : Migration
    {
        /// <inheritdoc />
        /// <remarks>
        /// A conditional insert, not <c>InsertData</c>. Before this migration the
        /// marker row was created lazily by the first <c>SetAsync</c>, so a database
        /// that has already run one refresh holds it and a plain INSERT would fail on
        /// the primary key. <c>TryClaimAttemptAsync</c> only needs the row to exist;
        /// it does not care which of the two created it.
        /// </remarks>
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                INSERT INTO "BondValuationRefreshStates" ("Id", "LastAsOf", "LastAttemptDate")
                VALUES (1, NULL, NULL)
                ON CONFLICT ("Id") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "BondValuationRefreshStates",
                keyColumn: "Id",
                keyValue: 1L);
        }
    }
}
