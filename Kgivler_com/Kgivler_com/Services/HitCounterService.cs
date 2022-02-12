using Kgivler_com.Data;
using Kgivler_com.Models;
using Microsoft.EntityFrameworkCore;

namespace Kgivler_com.Services
{
    public class HitCounterService : IHitCounterService
    {
        private readonly ApplicationDbContext _dbContext;

        public HitCounterService(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<int> PageHitIncrement(string path)
        {
            var hits = await _dbContext.PageHits
                .Where(h => h.Path == path)
                .SingleOrDefaultAsync();

            if (hits == null)
            {
                hits = new PageHit
                {
                    Path = path,
                    Hits = 0
                };

                _dbContext.Add(hits);
            }

            hits.Hits++;
            await _dbContext.SaveChangesAsync();

            return hits.Hits;
        }

        public async Task<int> GetPageHits(string path)
        {
            var hits = await _dbContext.PageHits
                .Where(h => h.Path == path)
                .SingleOrDefaultAsync();

            if (hits == null)
            {
                return 0;
            }

            return hits.Hits;
        }
    }
}
