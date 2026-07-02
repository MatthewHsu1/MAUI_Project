using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppName.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBondValuationSnapshotAndRefreshState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BondValuationRefreshStates",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false),
                    LastAsOf = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    LastAttemptDate = table.Column<DateOnly>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BondValuationRefreshStates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BondValuationSnapshots",
                columns: table => new
                {
                    Symbol = table.Column<string>(type: "TEXT", nullable: false),
                    ConversionShares = table.Column<decimal>(type: "TEXT", nullable: false),
                    ConversionValue = table.Column<decimal>(type: "TEXT", nullable: false),
                    StockPrice = table.Column<decimal>(type: "TEXT", nullable: false),
                    AsOf = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    BondPrice = table.Column<decimal>(type: "TEXT", nullable: true),
                    IsInTheMoney = table.Column<bool>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BondValuationSnapshots", x => x.Symbol);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BondValuationRefreshStates");

            migrationBuilder.DropTable(
                name: "BondValuationSnapshots");
        }
    }
}
