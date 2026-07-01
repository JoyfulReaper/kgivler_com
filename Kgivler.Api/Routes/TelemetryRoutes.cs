/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api.BackgroundServices;
using Kgivler.Api.Helpers;
using JoyfulReaperLib.JRData;
using JoyfulReaperLib.JRData.Web;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Kgivler.Api.Routes;

public static class TelemetryRoutes
{
    public static WebApplication MapTelemetryRoutes(this WebApplication app)
    {
        app.MapGet("/api/system/usage", async (HttpContext context, SqliteConnection db) =>
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
            var weather = await TelemetricsHelper.GetLocalWeather();
            var hitResults = await HitCountHelper.ProcessHitCounts(db, ip);
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
                TotalRequestsHandled = hitResults.totalHits,
                UniqueVisitors = hitResults.uniqueVisitors
            };

            return Results.Ok(telemetry);
        }).RequireRateLimiting("TelemetryPolicy");

        app.MapGet("/api/system/status", async (SqliteConnection db) =>
        {
            var currentProcess = Process.GetCurrentProcess();
            var uptimeSpan = TimeSpan.FromMilliseconds(Environment.TickCount64);

            var storage = TelemetricsHelper.GetStorageMetrics();
            var ram = TelemetricsHelper.GetRamMetrics();
            var gpu = TelemetricsHelper.GetGpuMetrics();
            var stardate = TelemetricsHelper.GetStarDate();
            var weather = await TelemetricsHelper.GetLocalWeather();
            var hitResults = await HitCountHelper.GetHitCounts(db);

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
                TotalRequestsHandled = hitResults.totalHits,
                UniqueVisitors = hitResults.uniqueVisitors
            };

            return Results.Ok(telemetry);
        }).RequireRateLimiting("TelemetryPolicy");

        return app;
    }
}
