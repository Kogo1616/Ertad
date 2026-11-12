using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ertad.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class StoreImage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Stores",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Stores");
        }
    }
}
