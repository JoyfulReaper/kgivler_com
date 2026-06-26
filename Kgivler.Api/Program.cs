/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api.BackgroundServices;
using Kgivler.Api.Extensions;
using Kgivler.Api.Helpers;
using Microsoft.Data.Sqlite;
using System.Diagnostics;
using System.Runtime.InteropServices;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApplicationServices(builder.Environment);

var app = builder.Build();
app.ConfigurePipeline();

// Sqlite Configuration
var baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
var dataFolder = Path.Combine(baseDirectory, "Data");
Directory.CreateDirectory(dataFolder);

var dbFile = "hitcounter.db";
var dbPath = Path.Combine(dataFolder, dbFile);

var connectionString = $"Data Source={dbPath};Mode=ReadWriteCreate;Cache=Shared;";
using (var connection = new SqliteConnection(connectionString))
{
    connection.Open();
    var command = connection.CreateCommand();
    command.CommandText = @"
        CREATE TABLE IF NOT EXISTS Visitors (
            IpAddress TEXT PRIMARY KEY,
            Hits INTEGER DEFAULT 1,
            LastSeen TEXT
        );
    ";
    command.ExecuteNonQuery();
}


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/api/error");
    app.UseHsts();
}

// Routes
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