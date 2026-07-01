/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api.Steam;
using Microsoft.AspNetCore.RateLimiting;

namespace Kgivler.Api.Routes;

public static class SteamRoutes
{
    public static WebApplication MapSteamRoutes(this WebApplication app)
    {
        app.MapGet("/api/steam/presence", async (
            SteamPresenceService steamPresenceService,
            CancellationToken cancellationToken) =>
        {
            var presence = await steamPresenceService.GetPresenceAsync(cancellationToken);
            if (presence is null)
            {
                return Results.Problem(
                    title: "Steam presence is not configured.",
                    detail: "Set Steam:ApiKey and Steam:OwnerSteamId to enable the badge.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            return Results.Ok(presence);
        }).RequireRateLimiting("SteamPolicy");

        return app;
    }
}
