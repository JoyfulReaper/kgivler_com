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

var app = builder.Build();
app.UseCors("MainSiteCorsPolicy");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/api/error");
    app.UseHsts();
}

// Routes
long globalTrafficCounter = 0;
app.MapGet("/api/system/usage", async () =>
{
    long currentHits = Interlocked.Increment(ref globalTrafficCounter);

    var currentProcess = Process.GetCurrentProcess();
    var uptimeSpan = TimeSpan.FromMilliseconds(Environment.TickCount64);

    var storage = TelemetricsHelper.GetStorageMetrics();
    var ram = TelemetricsHelper.GetRamMetrics();
    var gpu = TelemetricsHelper.GetGpuMetrics();
    var cpuUsage = TelemetricsHelper.GetCpuUsage();
    var stardate = TelemetricsHelper.GetStarDate();
    var weather = await TelemetricsHelper.GetLocalWeather();

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
        TotalRequestsHandled = currentHits
    };

    return Results.Ok(telemetry);
});

app.Run();