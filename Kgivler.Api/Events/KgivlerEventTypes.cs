namespace Kgivler.Api.Events;

public static class KgivlerEventTypes
{
    public const string BbsMessageCreated =
        "kgivler.bbs.message.created";

    public const string BbsMessagesRetrieved =
        "kgivler.bbs.message.retrieved";

    public const string CodeReviewCompleted =
        "kgivler.code-review.completed";

    public const string SteamPresenceRequestCompleted =
        "kgivler.steam-presence.request.completed";

    public const string SiteVisitRecorded =
        "kgivler.site-visit.recorded";
}