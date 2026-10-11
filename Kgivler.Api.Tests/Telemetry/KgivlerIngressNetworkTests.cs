using Kgivler.Api.Telemetry;
using Xunit;

namespace Kgivler.Api.Tests.Telemetry;

public sealed class KgivlerIngressNetworkTests
{
    [Theory]
    [InlineData("kgivler.com", "public")]
    [InlineData("api.kgivler.com", "public")]
    [InlineData("router.dn42", "dn42")]
    [InlineData("service.i2p", "i2p")]
    [InlineData("api.ygg.kgivler.com", "yggdrasil")]
    [InlineData("API.YGG.KGIVLER.COM.", "yggdrasil")]
    [InlineData("unrelated.example", "unknown")]
    [InlineData("notkgivler.com", "unknown")]
    public void FromHost_ClassifiesKgivlerIngressRules(
        string host,
        string expected)
    {
        var actual = KgivlerIngressNetwork.FromHost(host);

        Assert.Equal(expected, actual);
    }
}
