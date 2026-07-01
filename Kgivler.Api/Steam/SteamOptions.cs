namespace Kgivler.Api.Steam;

public sealed class SteamOptions
{
    public string ApiKey { get; set; } = string.Empty;

    public string OwnerSteamId { get; set; } = string.Empty;

    public int CacheSeconds { get; set; } = 60;
}
