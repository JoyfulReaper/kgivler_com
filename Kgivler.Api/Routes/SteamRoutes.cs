/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api.Steam;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System.Net.Http.Json;

namespace Kgivler.Api.Routes;

public static class SteamRoutes
{
    public static WebApplication MapSteamRoutes(this WebApplication app)
    {
        app.MapGet("/api/steam/presence", async (
            IMemoryCache memoryCache,
            IHttpClientFactory httpClientFactory,
            IOptions<SteamOptions> steamOptions,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            var options = steamOptions.Value;
            var apiKey = options.ApiKey;
            var ownerSteamId = options.OwnerSteamId;
            var cacheSeconds = options.CacheSeconds;

            if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(ownerSteamId))
            {
                return Results.Problem(
                    title: "Steam presence is not configured.",
                    detail: "Set Steam:ApiKey and Steam:OwnerSteamId to enable the badge.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            var cacheKey = $"steam-presence:{ownerSteamId}";
            if (memoryCache.TryGetValue(cacheKey, out SteamPresenceResponse? cachedPresence) &&
                cachedPresence is not null)
            {
                return Results.Ok(cachedPresence);
            }

            var steamApi = httpClientFactory.CreateClient("SteamApi");
            var normalizedCacheSeconds = Math.Clamp(cacheSeconds, 30, 300);

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(5));

            try
            {
                var url =
                    $"ISteamUser/GetPlayerSummaries/v2/?key={Uri.EscapeDataString(apiKey)}&steamids={Uri.EscapeDataString(ownerSteamId)}";

                var result = await steamApi.GetFromJsonAsync<SteamPlayerSummariesResponse>(
                    url,
                    timeoutCts.Token);

                var player = result?.Response?.Players?.FirstOrDefault();

                if (player is null)
                {
                    var unavailablePresence = new SteamPresenceResponse(
                        IsOnline: false,
                        IsInGame: false,
                        PersonaName: null,
                        GameId: null,
                        GameName: null,
                        StatusText: "Steam profile unavailable");

                    memoryCache.Set(
                        cacheKey,
                        unavailablePresence,
                        TimeSpan.FromSeconds(normalizedCacheSeconds));

                    return Results.Ok(unavailablePresence);
                }

                var gameId = player?.GameId;
                var gameName = player?.GameExtraInfo;

                if (string.IsNullOrWhiteSpace(gameName) && !string.IsNullOrWhiteSpace(gameId))
                {
                    gameName = await ResolveSteamGameNameAsync(
                        httpClientFactory,
                        gameId,
                        timeoutCts.Token);
                }

                var isInGame = !string.IsNullOrWhiteSpace(gameId) ||
                               !string.IsNullOrWhiteSpace(gameName);
                var statusText = isInGame
                    ? $"In-game: {gameName ?? $"AppID {gameId ?? "unknown"}"}"
                    : player?.PersonaState switch
                    {
                        0 => "Offline",
                        1 => "Online",
                        2 => "Busy",
                        3 => "Away",
                        4 => "Snooze",
                        5 => "Looking to trade",
                        6 => "Looking to play",
                        _ => "Unknown"
                    };

                var presence = new SteamPresenceResponse(
                    IsOnline: player?.PersonaState > 0,
                    IsInGame: isInGame,
                    PersonaName: player?.PersonaName,
                    GameId: gameId,
                    GameName: gameName,
                    StatusText: statusText);

                memoryCache.Set(
                    cacheKey,
                    presence,
                    TimeSpan.FromSeconds(normalizedCacheSeconds));

                return Results.Ok(presence);
            }
            catch (OperationCanceledException)
            {
                logger.LogWarning("Steam presence request timed out.");
                return Results.Ok(new SteamPresenceResponse(
                    IsOnline: false,
                    IsInGame: false,
                    PersonaName: null,
                    GameId: null,
                    GameName: null,
                    StatusText: "Steam status unavailable"));
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "Could not reach Steam Web API.");
                return Results.Ok(new SteamPresenceResponse(
                    IsOnline: false,
                    IsInGame: false,
                    PersonaName: null,
                    GameId: null,
                    GameName: null,
                    StatusText: "Steam status unavailable"));
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Unexpected error while fetching Steam presence.");
                return Results.Ok(new SteamPresenceResponse(
                    IsOnline: false,
                    IsInGame: false,
                    PersonaName: null,
                    GameId: null,
                    GameName: null,
                    StatusText: "Steam status unavailable"));
            }
        }).RequireRateLimiting("SteamPolicy");

        return app;
    }

    private static async Task<string?> ResolveSteamGameNameAsync(
        IHttpClientFactory httpClientFactory,
        string gameId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(gameId))
        {
            return null;
        }

        var steamStore = httpClientFactory.CreateClient("SteamStore");
        var response = await steamStore.GetFromJsonAsync<SteamAppDetailsResponse>(
            $"appdetails?appids={Uri.EscapeDataString(gameId)}",
            cancellationToken);

        return response?.Success == true
            ? response.Data?.Name
            : null;
    }
}
