namespace Kgivler.Api.Bbs;

public sealed record BbsMessageCreatedEvent(
    int AuthorLength,
    int OriginalContentLength,
    int StoredContentLength,
    bool ContentTruncated,
    long DurationMilliseconds);