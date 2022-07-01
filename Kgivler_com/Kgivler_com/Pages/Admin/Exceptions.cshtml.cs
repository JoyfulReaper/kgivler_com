using kgivler_com.Models;
using kgivler_com.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace kgivler_com.Pages.Admin
{
    public class ExceptionsModel : PageModel
    {
        private readonly ExceptionService _exceptionService;

        public IEnumerable<ExceptionRecord> Exceptions { get; set; } = Enumerable.Empty<ExceptionRecord>();

        public ExceptionsModel(ExceptionService exceptionService)
        {
            _exceptionService = exceptionService;
        }

        public async Task<PageResult> OnGetAsync()
        {
            Exceptions = await _exceptionService.GetAllAsync();
            return Page();
        }
    }
}
