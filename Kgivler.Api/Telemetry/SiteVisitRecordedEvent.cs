namespace Kgivler.Api.Telemetry;

public sealed record SiteVisitRecordedEvent(
    string? VisitorId,
    string? UserAgent,
    bool IsUniqueVisitor,
    long TotalHits,
    long UniqueVisitors,
    long DurationMilliseconds);