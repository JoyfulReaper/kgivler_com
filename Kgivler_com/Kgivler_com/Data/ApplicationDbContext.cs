using Kgivler_com.Models;
using Microsoft.EntityFrameworkCore;

namespace Kgivler_com.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<PageHit> PageHits { get; set; }
    }
}
