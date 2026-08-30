using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppName.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBondValuationRefreshRetryNotBefore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RetryNotBefore",
                table: "BondValuationRefreshStates",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "BondValuationRefreshStates",
                keyColumn: "Id",
                keyValue: 1L,
                column: "RetryNotBefore",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RetryNotBefore",
                table: "BondValuationRefreshStates");
        }
    }
}
