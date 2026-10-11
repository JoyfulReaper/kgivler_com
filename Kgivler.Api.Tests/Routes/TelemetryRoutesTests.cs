using Kgivler.Api.Routes;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Kgivler.Api.Tests.Routes;

public sealed class TelemetryRoutesTests
{
    [Theory]
    [InlineData("api.kgivler.com", null, "public")]
    [InlineData("api.kgivler.i2p", null, "i2p")]
    [InlineData("api.kgivler.com", "api.kgivler.i2p", "i2p")]
    [InlineData("api.kgivler.com", "api.kgivler.dn42", "dn42")]
    [InlineData("api.kgivler.com", "api.ygg.kgivler.com", "yggdrasil")]
    [InlineData("api.kgivler.com", "  api.kgivler.dn42 , api.kgivler.com", "dn42")]
    [InlineData("api.kgivler.com", "", "public")]
    [InlineData("api.kgivler.com", "   ", "public")]
    [InlineData("api.kgivler.com", " , api.kgivler.dn42", "public")]
    public void CreateSiteVisitRecordedEvent_UsesIngressHostInPayload(
        string host,
        string? forwardedHost,
        string expectedIngressNetwork)
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString(host);
        if (forwardedHost is not null)
        {
            context.Request.Headers["X-Forwarded-Host"] = forwardedHost;
        }

        var payload = TelemetryRoutes.CreateSiteVisitRecordedEvent(
            context.Request,
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
