namespace Kgivler.Api.Telemetry;

public sealed record SiteVisitRecordedEvent(
    long TotalHits,
    long UniqueVisitors,
    long DurationMilliseconds);