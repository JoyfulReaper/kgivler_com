using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgivler_com.Migrations
{
    public partial class ExceptionLogging : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Path",
                table: "PageHits",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "ExceptionRecords",
                columns: table => new
                {
                    ExceptionRecordId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    StackTrace = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExceptionRecords", x => x.ExceptionRecordId);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExceptionRecords");

            migrationBuilder.AlterColumn<string>(
                name: "Path",
                table: "PageHits",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500);
        }
    }
}
