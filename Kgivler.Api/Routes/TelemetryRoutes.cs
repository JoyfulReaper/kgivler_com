/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using JoyfulReaperLib.MissionControl;
using JoyfulReaperLib.WebStats.Sqlite;
using Kgivler.Api.BackgroundServices;
using Kgivler.Api.Events;
using Kgivler.Api.Helpers;
using Kgivler.Api.Telemetry;
using Kgivler.Api.Weather;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Kgivler.Api.Routes;

public static class TelemetryRoutes
{
    public static WebApplication MapTelemetryRoutes(this WebApplication app)
    {
        // Record the hit
        app.MapGet("/api/system/usage", async (HttpContext context,
            ILogger<Program> logger,
            IMissionControlClient missionControlClient,
            WeatherService weatherService,
            IHitCounter hitCounter) =>
        {
            var forwardedHeader = context.Request.Headers["CF-Connecting-IP"].FirstOrDefault()
                               ?? context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                               ?? context.Connection.RemoteIpAddress?.ToString()
                               ?? "unknown";

            var ip = forwardedHeader.Split(',')[0].Trim();

            var currentProcess = Process.GetCurrentProcess();
            var uptimeSpan = TimeSpan.FromMilliseconds(Environment.TickCount64);

            var storage = TelemetricsHelper.GetStorageMetrics();
            var ram = TelemetricsHelper.GetRamMetrics();
            var gpu = TelemetricsHelper.GetGpuMetrics();
            var cpuUsage = TelemetricsHelper.GetCpuUsage();
            var stardate = TelemetricsHelper.GetStarDate();
            var weather = await weatherService.GetCurrentAsync();

            var occurredAt = DateTimeOffset.UtcNow;
            var correlationId = Guid.NewGuid().ToString("N");
            var hitStopwatch = Stopwatch.StartNew();

            var hitResults = await hitCounter.RecordHitAsync(ip);

            hitStopwatch.Stop();

            try
            {
                await missionControlClient.TryPublishAsync(
                    eventType: KgivlerEventTypes.SiteVisitRecorded,
                    payload: new SiteVisitRecordedEvent(
                        TotalHits: hitResults.TotalHits,
                        UniqueVisitors: hitResults.UniqueVisitors,
                        DurationMilliseconds: hitStopwatch.ElapsedMilliseconds),
                    occurredAt: occurredAt,
                    correlationId: correlationId,
                    cancellationToken: CancellationToken.None);
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Failed to publish site visit event {CorrelationId}.",
                    correlationId);
            }

            var telemetry = new
            {
                OS = RuntimeInformation.OSDescription,
                Architecture = RuntimeInformation.OSArchitecture.ToString(),
                Framework = RuntimeInformation.FrameworkDescription,
                Uptime = $"{uptimeSpan.Days}d {uptimeSpan.Hours}h {uptimeSpan.Minutes}m",
                AppMemoryUsageMB = currentProcess.WorkingSet64 / (1024 * 1024),
                CpuTimeSec = Math.Round(currentProcess.TotalProcessorTime.TotalSeconds, 2),
                CpuUsage = SystemCpuMonitor.CurrentCpuUsage,
                CpuCores = Environment.ProcessorCount,
                ProcessCount = Process.GetProcesses().Length,
                Storage = storage,
                RAM = ram,
                GPU = gpu,
                Stardate = stardate,
                Weather = weather,
                TotalRequestsHandled = hitResults.TotalHits,
                UniqueVisitors = hitResults.UniqueVisitors
            };

            return Results.Ok(telemetry);
        }).RequireRateLimiting("TelemetryPolicy");

        // Don't record a hit
        app.MapGet("/api/system/status", async (
            IHitCounter hitCounter,
            WeatherService weatherService) =>
        {
            var currentProcess = Process.GetCurrentProcess();
            var uptimeSpan = TimeSpan.FromMilliseconds(Environment.TickCount64);

            var storage = TelemetricsHelper.GetStorageMetrics();
            var ram = TelemetricsHelper.GetRamMetrics();
            var gpu = TelemetricsHelper.GetGpuMetrics();
            var stardate = TelemetricsHelper.GetStarDate();
            var weather = await weatherService.GetCurrentAsync();
            var hitResults = await hitCounter.GetHitCountsAsync();

            var telemetry = new
            {
                OS = RuntimeInformation.OSDescription,
                Architecture = RuntimeInformation.OSArchitecture.ToString(),
                Framework = RuntimeInformation.FrameworkDescription,
                Uptime = $"{uptimeSpan.Days}d {uptimeSpan.Hours}h {uptimeSpan.Minutes}m",
                AppMemoryUsageMB = currentProcess.WorkingSet64 / (1024 * 1024),
                CpuTimeSec = Math.Round(currentProcess.TotalProcessorTime.TotalSeconds, 2),
                CpuUsage = SystemCpuMonitor.CurrentCpuUsage,
                CpuCores = Environment.ProcessorCount,
                ProcessCount = Process.GetProcesses().Length,
                Storage = storage,
                RAM = ram,
                GPU = gpu,
                Stardate = stardate,
                Weather = weather,
                TotalRequestsHandled = hitResults.TotalHits,
                UniqueVisitors = hitResults.UniqueVisitors
            };

            return Results.Ok(telemetry);
        }).RequireRateLimiting("TelemetryPolicy");

        return app;
    }
}
