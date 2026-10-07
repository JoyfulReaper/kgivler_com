/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using JoyfulReaperLib.MissionControl;
using JoyfulReaperLib.Sqlite;
using Kgivler.Api.Extensions;
using Kgivler.Api.Routes;
using Kgivler.Api.ServicesStatus;
using Kgivler.Api.Steam;
using Kgivler.Api.Telemetry;
using Kgivler.Api.Weather;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// BBS Schema
var schemaSql = @"
            CREATE TABLE IF NOT EXISTS Messages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Author TEXT,
                Content TEXT,
                Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );";

var connectionString = SqliteDatabaseInitializer.Initialize("kgivler_com.db", schemaSql);

builder.Services.AddApplicationServices(connectionString, builder.Environment);

builder.Services.Configure<TelemetryOptions>(builder.Configuration.GetSection(TelemetryOptions.SectionName));
builder.Services.AddSingleton<VisitorIdProvider>();

builder.Services.AddMemoryCache();
builder.Services.Configure<ServicesStatusOptions>(
    builder.Configuration.GetSection(ServicesStatusOptions.SectionName));
builder.Services.AddScoped<SteamPresenceService>();
builder.Services.Configure<SteamOptions>(builder.Configuration.GetSection("Steam"));
builder.Services.AddMissionControlClient(builder.Configuration.GetSection(MissionControlClientOptions.SectionName));

builder.Services.AddSingleton<WeatherService>();

// Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("BbsPolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 5;
    });

    options.AddFixedWindowLimiter("TelemetryPolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 10;
        opt.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("SteamPolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 20;
        opt.QueueLimit = 0;
    });
});

// HttpClient for Git Activity
builder.Services.AddHttpClient("GitActivity", client =>
{
    var baseUrl =
        builder.Configuration["GitActivity:BaseUrl"]
        ?? "https://activity.kgivler.com/";

    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(5);
});

// HttpClient for the configured Mission Control Agent fleet
builder.Services.AddHttpClient("ServicesStatusAgents", client =>
{
    var timeoutSeconds = Math.Clamp(
        builder.Configuration.GetValue<int?>(
            "ServicesStatus:TimeoutSeconds") ?? 5,
        1,
        15);

    client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
});

// Steam HttpClients
builder.Services.AddHttpClient("SteamApi", client =>
{
    client.BaseAddress = new Uri("https://api.steampowered.com/");
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddHttpClient("SteamStore", client =>
{
    client.BaseAddress = new Uri("https://store.steampowered.com/api/");
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Weather HttpClient
builder.Services.AddHttpClient("Weather", client =>
{
    client.BaseAddress = new Uri("https://wttr.in/");
    client.Timeout = TimeSpan.FromSeconds(2);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("kgivler-api");
});

var app = builder.Build();
app.ConfigurePipeline(builder.Environment);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGitActivityRoutes();
app.MapSteamRoutes();
app.MapBbsRoutes();
app.MapTelemetryRoutes();
app.MapServicesStatusRoutes();

app.Run();
