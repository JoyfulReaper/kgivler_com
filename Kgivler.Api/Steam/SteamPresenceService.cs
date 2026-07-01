/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System.Net.Http.Json;

namespace Kgivler.Api.Steam;

public sealed class SteamPresenceService
{
    private readonly IMemoryCache _memoryCache;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly SteamOptions _options;
    private readonly ILogger<SteamPresenceService> _logger;

    public SteamPresenceService(
        IMemoryCache memoryCache,
        IHttpClientFactory httpClientFactory,
        IOptions<SteamOptions> options,
        ILogger<SteamPresenceService> logger)
    {
        _memoryCache = memoryCache;
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<SteamPresenceResponse?> GetPresenceAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.OwnerSteamId))
        {
            return null;
        }

        var cacheKey = $"steam-presence:{_options.OwnerSteamId}";
        if (_memoryCache.TryGetValue(cacheKey, out SteamPresenceResponse? cachedPresence) &&
            cachedPresence is not null)
        {
            return cachedPresence;
        }

        var steamApi = _httpClientFactory.CreateClient("SteamApi");
        var normalizedCacheSeconds = Math.Clamp(_options.CacheSeconds, 30, 300);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(5));

        try
        {
            var url =
                $"ISteamUser/GetPlayerSummaries/v2/?key={Uri.EscapeDataString(_options.ApiKey)}&steamids={Uri.EscapeDataString(_options.OwnerSteamId)}";

            var result = await steamApi.GetFromJsonAsync<SteamPlayerSummariesResponse>(
                url,
                timeoutCts.Token);

            var player = result?.Response?.Players?.FirstOrDefault();

            if (player is null)
            {
                return CachePresence(cacheKey, normalizedCacheSeconds, new SteamPresenceResponse(
                    IsOnline: false,
                    IsInGame: false,
                    PersonaName: null,
                    GameId: null,
                    GameName: null,
                    StatusText: "Steam profile unavailable"));
            }

            var gameId = player.GameId;
            var gameName = player.GameExtraInfo;

            if (string.IsNullOrWhiteSpace(gameName) && !string.IsNullOrWhiteSpace(gameId))
            {
                gameName = await ResolveSteamGameNameAsync(gameId, timeoutCts.Token);
            }

            var isInGame = !string.IsNullOrWhiteSpace(gameId) ||
                           !string.IsNullOrWhiteSpace(gameName);
            var statusText = isInGame
                ? $"In-game: {gameName ?? $"AppID {gameId ?? "unknown"}"}"
                : player.PersonaState switch
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

            return CachePresence(cacheKey, normalizedCacheSeconds, new SteamPresenceResponse(
                IsOnline: player.PersonaState > 0,
                IsInGame: isInGame,
                PersonaName: player.PersonaName,
                GameId: gameId,
                GameName: gameName,
                StatusText: statusText));
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Steam presence request timed out.");
            return BuildUnavailablePresence();
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Could not reach Steam Web API.");
            return BuildUnavailablePresence();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error while fetching Steam presence.");
            return BuildUnavailablePresence();
        }
    }

    private SteamPresenceResponse CachePresence(string cacheKey, int cacheSeconds, SteamPresenceResponse presence)
    {
        _memoryCache.Set(
            cacheKey,
            presence,
            TimeSpan.FromSeconds(cacheSeconds));

        return presence;
    }

    private SteamPresenceResponse BuildUnavailablePresence()
    {
        return new SteamPresenceResponse(
            IsOnline: false,
            IsInGame: false,
            PersonaName: null,
            GameId: null,
            GameName: null,
            StatusText: "Steam status unavailable");
    }

    private async Task<string?> ResolveSteamGameNameAsync(string gameId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(gameId))
        {
            return null;
        }

        var steamStore = _httpClientFactory.CreateClient("SteamStore");
        var response = await steamStore.GetFromJsonAsync<SteamAppDetailsResponse>(
            $"appdetails?appids={Uri.EscapeDataString(gameId)}",
            cancellationToken);

        return response?.Success == true
            ? response.Data?.Name
            : null;
    }
}
