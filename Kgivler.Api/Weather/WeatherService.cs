using Microsoft.Extensions.Caching.Memory;

namespace Kgivler.Api.Weather;

public sealed class WeatherService
{
    private const string CacheKey = "telemetry.weather";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;

    public WeatherService(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
    }

    private const int WEATHER_CACHE_MINUTES = 30;

    public async Task<string> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        return await _cache.GetOrCreateAsync(CacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(WEATHER_CACHE_MINUTES); // TODO Make configurable

            try
            {
                var client = _httpClientFactory.CreateClient("Weather");
                var weather = await client.GetStringAsync("?format=3", cancellationToken);

                return weather.Trim();
            }
            catch (OperationCanceledException)
                when (!cancellationToken.IsCancellationRequested)
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
                return "Weather data offline";
            }
            catch
            {
                // Don't hammer wttr.in if it's having a bad day.
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);

                return "Weather data offline";
            }
        }) ?? "Weather data offline";
    }
}