using System.Text.Json.Serialization;

namespace Kgivler.Api.Steam;

public sealed record SteamPresenceResponse(
    bool IsOnline,
    bool IsInGame,
    string? PersonaName,
    string? GameId,
    string? GameName,
    string StatusText);

public sealed class SteamPlayerSummariesResponse
{
    [JsonPropertyName("response")]
    public SteamPlayerSummariesInner? Response { get; init; }
}

public sealed class SteamPlayerSummariesInner
{
    [JsonPropertyName("players")]
    public List<SteamPlayerSummary>? Players { get; init; }
}

public sealed class SteamPlayerSummary
{
    [JsonPropertyName("steamid")]
    public string? SteamId { get; init; }

    [JsonPropertyName("personaname")]
    public string? PersonaName { get; init; }

    [JsonPropertyName("personastate")]
    public int PersonaState { get; init; }

    [JsonPropertyName("gameid")]
    public string? GameId { get; init; }

    [JsonPropertyName("gameextrainfo")]
    public string? GameExtraInfo { get; init; }
}

public sealed class SteamAppDetailsResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; init; }

    [JsonPropertyName("data")]
    public SteamAppDetailsData? Data { get; init; }
}

public sealed class SteamAppDetailsData
{
    [JsonPropertyName("name")]
    public string? Name { get; init; }
}
