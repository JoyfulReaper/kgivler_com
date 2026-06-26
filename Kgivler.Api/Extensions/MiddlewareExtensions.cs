/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Microsoft.AspNetCore.HttpOverrides;
using System.Net;

namespace Kgivler.Api.Extensions;

public static class MiddlewareExtensions
{
    public static IApplicationBuilder ConfigurePipeline(this IApplicationBuilder app, IHostEnvironment env)
    {
        // Configure the HTTP request pipeline.
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }
        else
        {
            app.UseExceptionHandler("/api/error");
            app.UseHsts();
        }

        // Forwarded Headers
        var forwardedOptions = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
        };
        forwardedOptions.KnownIPNetworks.Clear();
        forwardedOptions.KnownProxies.Clear();
        forwardedOptions.KnownProxies.Add(IPAddress.Loopback);
        forwardedOptions.KnownProxies.Add(IPAddress.IPv6Loopback);

        app.UseForwardedHeaders(forwardedOptions);

        // Cloudflare Middleware
        app.Use((context, next) =>
        {
            if (context.Request.Headers.TryGetValue("CF-Visitor", out var cfVisitor) &&
                cfVisitor.ToString().Contains("\"scheme\":\"https\""))
            {
                context.Request.Headers["X-Forwarded-Proto"] = "https";
            }
            return next();
        });

        app.UseCors("MainSiteCorsPolicy");

        return app;
    }
}