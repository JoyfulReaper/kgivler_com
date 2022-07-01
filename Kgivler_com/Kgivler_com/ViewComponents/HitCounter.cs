using kgivler_com.Services;
using Microsoft.AspNetCore.Mvc;

namespace kgivler_com.ViewComponents;

public class HitCounter : ViewComponent
{
    private readonly HitCounterService _hitCounter;

    public HitCounter(HitCounterService hitCounter)
    {
        _hitCounter = hitCounter;
    }

    public async Task<IViewComponentResult> InvokeAsync()
    {
        return View(await _hitCounter.PageHitIncrement(HttpContext.Request.Path));
    }
}
