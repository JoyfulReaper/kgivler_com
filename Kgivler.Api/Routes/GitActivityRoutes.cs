/*
 * kgivler_com
 *
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api.GitActivity;
using Microsoft.Extensions.Caching.Memory;

namespace Kgivler.Api.Routes;

public static class GitActivityRoutes
{
    private const string CacheKey = "recent-git-activity";

    public static WebApplication MapGitActivityRoutes(
        this WebApplication app)
    {
        app.MapGet(
            "/api/github/activity",
            async (
                int? limit,
                IHttpClientFactory httpClientFactory,
                IConfiguration configuration,
                IMemoryCache cache,
                ILogger<Program> logger,
                CancellationToken cancellationToken) =>
            {
                var effectiveLimit = Math.Clamp(
                    limit ?? 5,
                    1,
                    20);

                var cacheKey = $"{CacheKey}:{effectiveLimit}";

                if (cache.TryGetValue(
                        cacheKey,
                        out GitActivityItem[]? cached) &&
                    cached is not null)
                {
                    return Results.Ok(cached);
                }

                var apiKey =
                    configuration["GitActivity:ApiKey"];

                if (string.IsNullOrWhiteSpace(apiKey))
                {
                    logger.LogError(
                        "GitActivity API key is not configured.");

                    return Results.Problem(
                        title: "Git activity is unavailable.",
                        statusCode:
                            StatusCodes.Status503ServiceUnavailable);
                }

                var client =
                    httpClientFactory.CreateClient("GitActivity");

                using var request = new HttpRequestMessage(
                    HttpMethod.Get,
                    $"api/github/activity?limit={effectiveLimit}");

                request.Headers.TryAddWithoutValidation(
                    "X-Mission-Control-Key",
                    apiKey);

                try
                {
                    using var response =
                        await client.SendAsync(
                            request,
                            cancellationToken);

                    if (!response.IsSuccessStatusCode)
                    {
                        logger.LogWarning(
                            "GitActivity returned status {StatusCode}.",
                            response.StatusCode);

                        return Results.Problem(
                            title: "Git activity is unavailable.",
                            statusCode:
                                StatusCodes.Status502BadGateway);
                    }

                    var activity =
                        await response.Content
                            .ReadFromJsonAsync<GitActivityItem[]>(
                                cancellationToken);

                    activity ??= [];

                    cache.Set(
                        cacheKey,
                        activity,
                        TimeSpan.FromMinutes(1));

                    return Results.Ok(activity);
                }
                catch (OperationCanceledException)
                    when (!cancellationToken.IsCancellationRequested)
                {
                    return Results.Problem(
                        title: "Git activity request timed out.",
                        statusCode:
                            StatusCodes.Status504GatewayTimeout);
                }
                catch (HttpRequestException exception)
                {
                    logger.LogWarning(
                        exception,
                        "Could not reach GitActivity.");

                    return Results.Problem(
                        title: "Git activity is unavailable.",
                        statusCode:
                            StatusCodes.Status502BadGateway);
                }
            });

        return app;
    }
}