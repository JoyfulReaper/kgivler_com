using Kgivler_com.Data;
using Kgivler_com.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Kgivler_com.Pages.Admin
{
    public class ExceptionsModel : PageModel
    {
        public IEnumerable<ExceptionRecord> Exceptions { get; set; }
        private readonly ApplicationDbContext _dbContext;

        public ExceptionsModel(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public PageResult OnGet()
        {
            Exceptions = _dbContext.ExceptionRecords.Take(100);
            return Page();
        }
    }
}
