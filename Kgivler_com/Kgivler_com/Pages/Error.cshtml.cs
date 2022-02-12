using Kgivler_com.Data;
using Kgivler_com.Models;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Diagnostics;

namespace Kgivler_com.Pages
{
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    [IgnoreAntiforgeryToken]
    public class ErrorModel : PageModel
    {
        public string? RequestId { get; set; }

        public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);

        private readonly ILogger<ErrorModel> _logger;
        private readonly ApplicationDbContext _context;

        public ErrorModel(ILogger<ErrorModel> logger,
            ApplicationDbContext context)
        {
            _logger = logger;
            _context = context;
        }

        public async void OnGet()
        {
            RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;

            var exceptionHandlerPathFeature =
                HttpContext.Features.Get<IExceptionHandlerPathFeature>();

            var exception = exceptionHandlerPathFeature.Error;

            ExceptionRecord record = new ExceptionRecord
            {
                Message = exception.Message.Length > 1000 ? exception.Message.Substring(0, 1000) : exception.Message,
                StackTrace = exception.StackTrace.Length > 3000 ? exception.StackTrace.Substring(0, 3000) : exception.StackTrace,
            };

            _context.Add(record);
            await _context.SaveChangesAsync();
        }
    }
}