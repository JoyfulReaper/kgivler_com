using Kgivler_com.Data;

namespace Kgivler_com.Middleware
{
    public class UAMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ApplicationDbContext _dbContext;

        public UAMiddleware(RequestDelegate next,
            ApplicationDbContext dbContext)
        {
            _next = next;
            _dbContext = dbContext;
        }

        public async Task Invoke(HttpContext context)
        {
            var page = context.Request.RouteValues["page"];

            if(page != null)
            {
                var userAgent = context.Request.Headers.UserAgent;
            }

            await _next(context);
        }
    }
}
