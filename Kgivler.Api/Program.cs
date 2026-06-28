/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using JoyfulReaperLib.JRData;
using JoyfulReaperLib.JRData.Web;
using Kgivler.Api.BackgroundServices;
using Kgivler.Api.Bbs;
using Kgivler.Api.Extensions;
using Kgivler.Api.Helpers;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;
using System.Diagnostics;
using System.Runtime.InteropServices;

var builder = WebApplication.CreateBuilder(args);
var schema = @"
            CREATE TABLE IF NOT EXISTS Messages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Author TEXT,
                Content TEXT,
                Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );";

var connectionString = SqliteHelper.InitializeSqlite("kgivler_com.db", schema);

builder.Services.AddApplicationServices(connectionString, builder.Environment);
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("BbsPolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 5;
    });
});

var app = builder.Build();
app.ConfigurePipeline(builder.Environment);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Routes

// Get the last 5 BBS messages
app.MapGet("/api/bbs", async (SqliteConnection db) =>
{
    var messages = new List<Message>();
    try
    {
        await db.OpenAsync();
        var messageCmd = db.CreateCommand();
        messageCmd.CommandText = "SELECT Id, Author, Content, Timestamp FROM Messages ORDER BY Timestamp DESC LIMIT 5";

        using var reader = await messageCmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            messages.Add(new Message
            {
                Id = reader.GetInt32(0),
                Author = reader.GetString(1),
                Content = reader.GetString(2),
                Timestamp = reader.GetDateTime(3)
            });
        }
    }
    catch
    {
        // TODO: Logging
        Results.Problem("An error occurred while fetching messages.");
    }

    return Results.Ok(messages);
});

// Post a new message
app.MapPost("/api/bbs", async (Message msg, SqliteConnection db) =>
{
    try
    {
        // Escape HTML and truncate to 256 characters
        var content = msg.Content.Length > 256 ? msg.Content[..256] : msg.Content;
        var escapedContent = System.Net.WebUtility.HtmlEncode(content);

        await db.OpenAsync();
        var messageCmd = db.CreateCommand();
        messageCmd.CommandText = "INSERT INTO Messages (Author, Content) VALUES ($author, $content);";
        messageCmd.Parameters.AddWithValue("$author", msg.Author);
        messageCmd.Parameters.AddWithValue("$content", escapedContent);

        await messageCmd.ExecuteNonQueryAsync();
        return Results.Created("/api/bbs", new { status = "success", message = "Post received." });
    }
    catch (Exception ex)
    {
        // TODO: Logging
        return Results.Problem("An error occurred while saving your message.");
    }
}).RequireRateLimiting("BbsPolicy");

// System Telemetry
app.MapGet("/api/system/usage", async (HttpContext context) =>
{
    // Extract the real IP address
    var forwardedHeader = context.Request.Headers["CF-Connecting-IP"].FirstOrDefault()
                       ?? context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                       ?? context.Connection.RemoteIpAddress?.ToString()
                       ?? "unknown";

    // If multiple IPs are in X-Forwarded-For, take the first one
    var ip = forwardedHeader.Split(',')[0].Trim();

    var currentProcess = Process.GetCurrentProcess();
    var uptimeSpan = TimeSpan.FromMilliseconds(Environment.TickCount64);

    var storage = TelemetricsHelper.GetStorageMetrics();
    var ram = TelemetricsHelper.GetRamMetrics();
    var gpu = TelemetricsHelper.GetGpuMetrics();
    var cpuUsage = TelemetricsHelper.GetCpuUsage();
    var stardate = TelemetricsHelper.GetStarDate();
    var weather = await TelemetricsHelper.GetLocalWeather();
    var hitResults = await HitCountHelper.ProcessHitCounts(connectionString, ip);
    var telemetry = new
    {
        OS = RuntimeInformation.OSDescription,
        Architecture = RuntimeInformation.OSArchitecture.ToString(),
        Framework = RuntimeInformation.FrameworkDescription,
        Uptime = $"{uptimeSpan.Days}d {uptimeSpan.Hours}h {uptimeSpan.Minutes}m",
        AppMemoryUsageMB = currentProcess.WorkingSet64 / (1024 * 1024),
        CpuTimeSec = Math.Round(currentProcess.TotalProcessorTime.TotalSeconds, 2),

        // Core Performance Metrics
        CpuUsage = SystemCpuMonitor.CurrentCpuUsage,
        CpuCores = Environment.ProcessorCount,
        ProcessCount = Process.GetProcesses().Length,
        Storage = storage,
        RAM = ram,
        GPU = gpu,

        // Meta Metrics
        Stardate = stardate,
        Weather = weather,
        TotalRequestsHandled = hitResults.totalHits,
        UniqueVisitors = hitResults.uniqueVisitors
    };

    return Results.Ok(telemetry);
});

app.Run();