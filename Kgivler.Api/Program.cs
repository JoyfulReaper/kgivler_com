/*
 * Random Steam Game
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api;
using Kgivler.Api.BackgroundServices;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddHostedService<SystemCpuMonitor>();

// CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("MainSiteCorsPolicy", policy =>
    {
        var allowedOrigins = new List<string>
        {
            "https://kgivler.com",
            "https://www.kgivler.com"
        };

        // Append local development tools if running locally
        if (builder.Environment.IsDevelopment())
        {
            allowedOrigins.Add("http://localhost:5500");   // VS Code Live Server default
            allowedOrigins.Add("http://127.0.0.1:5500");   // Alternate Live Server loopback
            allowedOrigins.Add("http://localhost:3000");   // Typical Vite/React dev server port
        }

        policy.WithOrigins(allowedOrigins.ToArray())
              .WithMethods("GET", "POST")
              .WithHeaders("Content-Type", "Authorization");
    });
});

// App Configuration
var app = builder.Build();

// Cloudfare Configuration
var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};

forwardedOptions.KnownIPNetworks.Clear();
forwardedOptions.KnownProxies.Clear();

// Explicitly trust the local loopback adapters so local proxy headers are respected
forwardedOptions.KnownProxies.Add(System.Net.IPAddress.Loopback);
forwardedOptions.KnownProxies.Add(System.Net.IPAddress.IPv6Loopback);

// Cloudflare CF-Visitor parsing middleware
app.Use((context, next) =>
{
    if (context.Request.Headers.TryGetValue("CF-Visitor", out var cfVisitor))
    {
        if (cfVisitor.ToString().Contains("\"scheme\":\"https\""))
        {
            context.Request.Headers["X-Forwarded-Proto"] = "https";
        }
    }
    return next();
});

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

app.UseCors("MainSiteCorsPolicy");
app.UseForwardedHeaders(forwardedOptions);

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
    var hitResults = await ProcessHitCounts(connectionString, ip);


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


async static Task<(long totalHits, long uniqueVisitors)> ProcessHitCounts(string connectionString, string ip)
{
    
    long totalHits = 0;
    long uniqueVisitors = 0;

    // SQLite Upsert and Count
    using var connection = new SqliteConnection(connectionString);
    await connection.OpenAsync();

    // Update the hit count
    var upsertCmd = connection.CreateCommand();
    upsertCmd.CommandText = @"
            INSERT INTO Visitors (IpAddress, Hits, LastSeen)
            VALUES ($ip, 1, $date)
            ON CONFLICT(IpAddress) DO UPDATE SET
                Hits = Hits + 1,
                LastSeen = $date;
        ";
    upsertCmd.Parameters.AddWithValue("$ip", ip);
    upsertCmd.Parameters.AddWithValue("$date", DateTime.UtcNow.ToString("o"));
    await upsertCmd.ExecuteNonQueryAsync();

    // Get Totals
    var statsCmd = connection.CreateCommand();
    statsCmd.CommandText = "SELECT COUNT(IpAddress), SUM(Hits) FROM Visitors;";
    using var reader = await statsCmd.ExecuteReaderAsync();

    if (await reader.ReadAsync())
    {
        uniqueVisitors = reader.IsDBNull(0) ? 0 : reader.GetInt64(0);
        totalHits = reader.IsDBNull(1) ? 0 : reader.GetInt64(1);
    }
    
    return (totalHits, uniqueVisitors);
}