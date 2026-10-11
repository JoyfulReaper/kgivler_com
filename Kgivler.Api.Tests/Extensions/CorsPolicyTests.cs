using Kgivler.Api.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Xunit;

namespace Kgivler.Api.Tests.Extensions;

public sealed class CorsPolicyTests
{
    [Theory]
    [InlineData("http://kgivler.i2p", true)]
    [InlineData("http://api.kgivler.i2p", false)]
    [InlineData("https://kgivler.i2p", false)]
    [InlineData("http://other.i2p", false)]
    [InlineData("https://kgivler.com", true)]
    [InlineData("https://www.kgivler.com", true)]
    [InlineData("http://site.ygg.kgivler.com", true)]
    [InlineData("http://[301:762f:80bd:20e1::40]", true)]
    [InlineData("https://kgivler.dn42", true)]
    [InlineData("http://kgivler.dn42", true)]
    [InlineData("http://localhost:5500", false)]
    [InlineData("null", false)]
    public void ProductionPolicy_AllowsOnlyIntendedOrigins(string origin, bool allowed)
    {
        var policy = CreatePolicy(Environments.Production);
        Assert.Equal(allowed, policy.IsOriginAllowed(origin));
        Assert.Equal(new[] { "GET", "POST" }, policy.Methods);
        Assert.False(policy.SupportsCredentials);
    }

    [Theory]
    [InlineData("http://localhost:5500")]
    [InlineData("http://127.0.0.1:5500")]
    [InlineData("http://localhost:3000")]
    public void DevelopmentPolicy_PreservesLocalOrigins(string origin)
    {
        Assert.True(CreatePolicy(Environments.Development).IsOriginAllowed(origin));
    }

    private static CorsPolicy CreatePolicy(string environmentName)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = environmentName });
        builder.Services.AddApplicationServices("Data Source=:memory:", builder.Environment);
        using var services = builder.Services.BuildServiceProvider();
        return services.GetRequiredService<IOptions<CorsOptions>>().Value.GetPolicy("MainSiteCorsPolicy")!;
    }
}
