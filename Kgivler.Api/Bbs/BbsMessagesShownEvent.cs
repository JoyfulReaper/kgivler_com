namespace Kgivler.Api.Bbs;

public sealed record BbsMessagesShownEvent(
    int TotalMessagesShown,
    long DurationMilliseconds);