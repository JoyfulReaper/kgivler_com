using JoyfulReaperLib.JRNet;

namespace Kgivler.Api.Telemetry;

public static class KgivlerIngressNetwork
{
    private static readonly string[] PublicHostSuffixes = ["kgivler.com"];
    private static readonly string[] YggdrasilHostSuffixes = ["ygg.kgivler.com"];

    public static string FromHost(string host) =>
        IngressNetworkClassifier.FromHost(
            host,
            publicHostSuffixes: PublicHostSuffixes,
            yggdrasilHostSuffixes: YggdrasilHostSuffixes);
}
