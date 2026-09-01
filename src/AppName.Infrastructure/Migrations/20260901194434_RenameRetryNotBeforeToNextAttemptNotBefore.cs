using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppName.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameRetryNotBeforeToNextAttemptNotBefore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "RetryNotBefore",
                table: "BondValuationRefreshStates",
                newName: "NextAttemptNotBefore");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "NextAttemptNotBefore",
                table: "BondValuationRefreshStates",
                newName: "RetryNotBefore");
        }
    }
}
