namespace kgivler_com.MiddleWare;


public class UAMiddleware
{
    private readonly RequestDelegate _next;

    public UAMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task Invoke(HttpContext context)
    {
        var page = context.Request.RouteValues["page"];

        if (page != null)
        {
            var userAgent = context.Request.Headers.UserAgent;
        }

        await _next(context);
    }
}