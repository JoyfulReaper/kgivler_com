/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api.BackgroundServices;

namespace Kgivler.Api.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IWebHostEnvironment env)
    {
        // Add your background services
        services.AddHostedService<SystemCpuMonitor>();

        // CORS Configuration
        services.AddCors(options =>
        {
            options.AddPolicy("MainSiteCorsPolicy", policy =>
            {
                var allowedOrigins = new List<string> { "https://kgivler.com", "https://www.kgivler.com" };

                // Append local development tools if running locally
                if (env.IsDevelopment())
                {
                    allowedOrigins.AddRange(new[] { "http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000" });
                }

                policy.WithOrigins(allowedOrigins.ToArray())
                      .WithMethods("GET", "POST")
                      .WithHeaders("Content-Type", "Authorization");
            });
        });

        services.AddOpenApi();

        return services;
    }
}