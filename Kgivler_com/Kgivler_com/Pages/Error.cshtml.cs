using kgivler_com.Models;
using kgivler_com.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Diagnostics;

namespace kgivler_com.Pages;
[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
[IgnoreAntiforgeryToken]
public class ErrorModel : PageModel
{
    public string? RequestId { get; set; }

    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);

    private readonly ILogger<ErrorModel> _logger;
    private readonly ExceptionService _exceptionService;

    public ErrorModel(ILogger<ErrorModel> logger,
        ExceptionService exceptionService)
    {
        _logger = logger;
        _exceptionService = exceptionService;
    }

    public async void OnGet()
    {
        RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;

        var exceptionHandlerPathFeature =
                HttpContext.Features.Get<IExceptionHandlerPathFeature>();

        var exception = exceptionHandlerPathFeature?.Error ?? new Exception("Exception was null");
        string stackTrace = exception.StackTrace ?? "StackTrack was null";

        ExceptionRecord record = new ExceptionRecord
        {
            Message = exception.Message.Length > 1000 ? exception.Message.Substring(0, 1000) : exception.Message,
            StackTrace = stackTrace.Length > 3000 ? stackTrace.Substring(0, 3000) : stackTrace,
        };

        await _exceptionService.SaveAsync(record);
    }
}

