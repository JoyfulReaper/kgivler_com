using Kgivler_com.Data;
using Microsoft.EntityFrameworkCore;

namespace Kgivler_com.Infrastructure
{
    public static class DatabaseSeeder
    {
        public static void EnsurePopulated(WebApplication app)
        {
            ApplicationDbContext context = app.Services.CreateScope().ServiceProvider.GetRequiredService<ApplicationDbContext>();

            if(context.Database.GetPendingMigrations().Any())
            {
                context.Database.Migrate();
            }
        }
    }
}
