﻿using Microsoft.AspNetCore.Mvc.Rendering;

namespace Kgivler_com.Extensions
{
    public static class HtmlHelperExtensions
    {
        public static string ActiveClass(this IHtmlHelper htmlHelper, string route)
        {
            var routeData = htmlHelper.ViewContext.RouteData;

            var pageRoute = routeData.Values["page"].ToString();

            return route == pageRoute ? "active" : "";
        }
    }
}
