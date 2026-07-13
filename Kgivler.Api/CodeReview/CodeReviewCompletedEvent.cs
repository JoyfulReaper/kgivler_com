namespace Kgivler.Api.CodeReview;

public sealed record CodeReviewCompletedEvent(
    string? Language,
    int CodeLength,
    string ReviewMode,
    int ChunkCount,
    int ReviewLength,
    string Model,
    long DurationMilliseconds,
    string Outcome,
    bool Succeeded);