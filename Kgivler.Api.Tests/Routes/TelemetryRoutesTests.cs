using Kgivler.Api.Routes;
using Xunit;

namespace Kgivler.Api.Tests.Routes;

public sealed class TelemetryRoutesTests
{
    [Theory]
    [InlineData("www.kgivler.com", "public")]
    [InlineData("api.ygg.kgivler.com", "yggdrasil")]
    public void CreateSiteVisitRecordedEvent_PlacesIngressNetworkInPayload(
        string host,
        string expectedIngressNetwork)
    {
        var payload = TelemetryRoutes.CreateSiteVisitRecordedEvent(
            host,
            visitorId: "visitor",
            userAgent: "test-agent",
            isUniqueVisitor: true,
            totalHits: 10,
            uniqueVisitors: 4,
            durationMilliseconds: 25);

        Assert.Equal(expectedIngressNetwork, payload.IngressNetwork);
        Assert.Equal("visitor", payload.VisitorId);
        Assert.Equal("test-agent", payload.UserAgent);
        Assert.True(payload.IsUniqueVisitor);
        Assert.Equal(10, payload.TotalHits);
        Assert.Equal(4, payload.UniqueVisitors);
        Assert.Equal(25, payload.DurationMilliseconds);
    }
}
