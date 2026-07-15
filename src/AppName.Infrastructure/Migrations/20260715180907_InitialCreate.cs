using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppName.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BondValuationRefreshStates",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false),
                    LastAsOf = table.Column<DateOnly>(type: "date", nullable: true),
                    LastAttemptDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BondValuationRefreshStates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BondValuationSnapshots",
                columns: table => new
                {
                    Symbol = table.Column<string>(type: "text", nullable: false),
                    ConversionShares = table.Column<decimal>(type: "numeric", nullable: false),
                    ConversionValue = table.Column<decimal>(type: "numeric", nullable: false),
                    StockPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    AsOf = table.Column<DateOnly>(type: "date", nullable: false),
                    BondPrice = table.Column<decimal>(type: "numeric", nullable: true),
                    IsInTheMoney = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BondValuationSnapshots", x => x.Symbol);
                });

            migrationBuilder.CreateTable(
                name: "ConvertibleBonds",
                columns: table => new
                {
                    Symbol = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ParValue = table.Column<decimal>(type: "numeric", nullable: false),
                    ConversionPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    UnderlyingSymbol = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConvertibleBonds", x => x.Symbol);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BondValuationRefreshStates");

            migrationBuilder.DropTable(
                name: "BondValuationSnapshots");

            migrationBuilder.DropTable(
                name: "ConvertibleBonds");
        }
    }
}
