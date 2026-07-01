/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api.CodeReview;
using Microsoft.AspNetCore.RateLimiting;
using System.Net.Http.Json;

namespace Kgivler.Api.Routes;

public static class CodeReviewRoutes
{
    public static WebApplication MapCodeReviewRoutes(this WebApplication app)
    {
        app.MapGet("/api/code-review/health", async (
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            var configuredModel = configuration["LmStudio:Model"]
                ?? "qwen2.5-coder-3b-instruct@q6_k";

            var lmStudio = httpClientFactory.CreateClient("LmStudio");

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(5));

            try
            {
                var response = await lmStudio.GetAsync("models", timeoutCts.Token);

                if (!response.IsSuccessStatusCode)
                {
                    return Results.Problem(
                        title: "LM Studio is reachable, but returned an error.",
                        detail: $"Status {(int)response.StatusCode}",
                        statusCode: StatusCodes.Status502BadGateway);
                }

                var models = await response.Content.ReadFromJsonAsync<LmStudioModelsResponse>(
                    cancellationToken: timeoutCts.Token);

                var modelAvailable = models?.Data?.Any(model =>
                    string.Equals(model.Id, configuredModel, StringComparison.OrdinalIgnoreCase)) ?? false;

                return Results.Ok(new
                {
                    status = "ok",
                    lmStudioReachable = true,
                    configuredModel,
                    modelAvailable
                });
            }
            catch (OperationCanceledException)
            {
                return Results.Problem(
                    title: "LM Studio health check timed out.",
                    detail: "Make sure the LM Studio server is running.",
                    statusCode: StatusCodes.Status504GatewayTimeout);
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "Could not reach LM Studio.");

                return Results.Problem(
                    title: "Could not reach LM Studio.",
                    detail: "Make sure LM Studio is running with the local server enabled.",
                    statusCode: StatusCodes.Status502BadGateway);
            }
        }).RequireRateLimiting("CodeReviewPolicy");

        app.MapPost("/api/code-review", async (
            CodeReviewRequest request,
            QwenCoderReviewService reviewService,
            CancellationToken cancellationToken) =>
        {
            return await reviewService.ReviewAsync(request, cancellationToken);
        }).RequireRateLimiting("CodeReviewPolicy");

        return app;
    }
}
