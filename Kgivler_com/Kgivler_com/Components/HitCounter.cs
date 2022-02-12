using Kgivler_com.Services;
using Microsoft.AspNetCore.Mvc;

namespace Kgivler_com.Components
{
    public class HitCounter : ViewComponent
    {
        private readonly IHitCounterService _hitCounter;

        public HitCounter(IHitCounterService hitCounter)
        {
            _hitCounter = hitCounter;
        }

        public async Task<IViewComponentResult> InvokeAsync()
        {
            return View(await _hitCounter.PageHitIncrement(HttpContext.Request.Path));
        }
    }
}
