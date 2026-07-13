/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using JoyfulReaperLib.MissionControl;
using Kgivler.Api.Events;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System.Diagnostics;

namespace Kgivler.Api.Steam;

public sealed class SteamPresenceService
{
    private readonly IMemoryCache _memoryCache;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly SteamOptions _options;
    private readonly ILogger<SteamPresenceService> _logger;
    private readonly IMissionControlClient _missionControlClient;

    public SteamPresenceService(
        IMemoryCache memoryCache,
        IHttpClientFactory httpClientFactory,
        IOptions<SteamOptions> options,
        IMissionControlClient missionControlClient,
        ILogger<SteamPresenceService> logger)
    {
        _memoryCache = memoryCache;
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _missionControlClient = missionControlClient;
        _logger = logger;
    }

    public async Task<SteamPresenceResponse?> GetPresenceAsync(CancellationToken cancellationToken)
    {
        var occurredAt = DateTimeOffset.UtcNow;
        var correlationId = Guid.NewGuid().ToString("N");
        var stopwatch = Stopwatch.StartNew();

        var configured =
            !string.IsNullOrWhiteSpace(_options.ApiKey) &&
            !string.IsNullOrWhiteSpace(_options.OwnerSteamId);

        if (!configured)
        {
            await PublishCompletedEventAsync(
                cacheResult: "not-applicable",
                configured: false,
                presence: null,
                stopwatch,
                outcome: "not-configured",
                succeeded: false,
                occurredAt,
                correlationId);

            return null;
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.OwnerSteamId))
        {
            return null;
        }

        var cacheKey = $"steam-presence:{_options.OwnerSteamId}";

        if (_memoryCache.TryGetValue(
                cacheKey,
                out SteamPresenceResponse? cachedPresence) &&
            cachedPresence is not null)
        {
            await PublishCompletedEventAsync(
                cacheResult: "hit",
                configured: true,
                presence: cachedPresence,
                stopwatch,
                outcome: "served",
                succeeded: true,
                occurredAt,
                correlationId);

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
                var unavailablePresence = CachePresence(
                    cacheKey,
                    normalizedCacheSeconds,
                    new SteamPresenceResponse(
                        IsOnline: false,
                        IsInGame: false,
                        PersonaName: null,
                        GameId: null,
                        GameName: null,
                        StatusText: "Steam profile unavailable"));

                await PublishCompletedEventAsync(
                    cacheResult: "miss",
                    configured: true,
                    presence: unavailablePresence,
                    stopwatch,
                    outcome: "profile-unavailable",
                    succeeded: true,
                    occurredAt,
                    correlationId);

                return unavailablePresence;
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

            var presence = CachePresence(
                cacheKey,
                normalizedCacheSeconds,
                new SteamPresenceResponse(
                    IsOnline: player.PersonaState > 0,
                    IsInGame: isInGame,
                    PersonaName: player.PersonaName,
                    GameId: gameId,
                    GameName: gameName,
                    StatusText: statusText));

            await PublishCompletedEventAsync(
                cacheResult: "miss",
                configured: true,
                presence,
                stopwatch,
                outcome: "served",
                succeeded: true,
                occurredAt,
                correlationId);

            return presence;
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            // The HTTP request or application was cancelled. Preserve normal
            // ASP.NET Core cancellation behavior instead of reporting timeout.
            _logger.LogDebug(
                "Steam presence request was cancelled by the caller.");

            throw;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning(
                "Steam presence request timed out.");

            var presence = BuildUnavailablePresence();

            await PublishCompletedEventAsync(
                cacheResult: "miss",
                configured: true,
                presence,
                stopwatch,
                outcome: "timeout",
                succeeded: false,
                occurredAt,
                correlationId);

            return presence;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(
                ex,
                "Could not reach Steam Web API.");

            var presence = BuildUnavailablePresence();

            await PublishCompletedEventAsync(
                cacheResult: "miss",
                configured: true,
                presence,
                stopwatch,
                outcome: "http-error",
                succeeded: false,
                occurredAt,
                correlationId);

            return presence;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Unexpected error while fetching Steam presence.");

            var presence = BuildUnavailablePresence();

            await PublishCompletedEventAsync(
                cacheResult: "miss",
                configured: true,
                presence,
                stopwatch,
                outcome: "failed",
                succeeded: false,
                occurredAt,
                correlationId);

            return presence;
        }
    }

    private async Task PublishCompletedEventAsync(
        string cacheResult,
        bool configured,
        SteamPresenceResponse? presence,
        Stopwatch stopwatch,
        string outcome,
        bool succeeded,
        DateTimeOffset occurredAt,
        string correlationId)
    {
        stopwatch.Stop();

        try
        {
            await _missionControlClient.TryPublishAsync(
                eventType:
                    KgivlerEventTypes.SteamPresenceRequestCompleted,
                payload: new SteamPresenceRequestCompletedEvent(
                    CacheResult: cacheResult,
                    Configured: configured,
                    IsOnline: presence?.IsOnline,
                    IsInGame: presence?.IsInGame,
                    GameId: presence?.GameId,
                    GameName: presence?.GameName,
                    DurationMilliseconds:
                        stopwatch.ElapsedMilliseconds,
                    Outcome: outcome,
                    Succeeded: succeeded),
                occurredAt: occurredAt,
                correlationId: correlationId,
                cancellationToken: CancellationToken.None);
        }
        catch (Exception exception)
        {
            // Telemetry must never break the Steam presence endpoint.
            _logger.LogWarning(
                exception,
                "Failed to publish Steam presence event {CorrelationId}.",
                correlationId);
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
