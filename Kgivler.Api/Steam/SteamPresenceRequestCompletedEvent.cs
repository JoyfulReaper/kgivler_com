namespace Kgivler.Api.Steam;

public sealed record SteamPresenceRequestCompletedEvent(
    string CacheResult,
    bool Configured,
    bool? IsOnline,
    bool? IsInGame,
    string? GameId,
    string? GameName,
    long DurationMilliseconds,
    string Outcome,
    bool Succeeded);