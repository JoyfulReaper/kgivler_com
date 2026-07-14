/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using JoyfulReaperLib.MissionControl;
using JoyfulReaperLib.Sqlite;
using Kgivler.Api.CodeReview;
using Kgivler.Api.Extensions;
using Kgivler.Api.Routes;
using Kgivler.Api.Steam;
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

builder.Services.AddScoped<QwenCoderReviewService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<SteamPresenceService>();
builder.Services.Configure<SteamOptions>(builder.Configuration.GetSection("Steam"));
builder.Services.AddMissionControlClient(
    builder.Configuration.GetSection(
        MissionControlClientOptions.SectionName));

// Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("BbsPolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 5;
    });

    options.AddFixedWindowLimiter("CodeReviewPolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 3;
        opt.QueueLimit = 0;
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

// HttpClient for LM Studio
builder.Services.AddHttpClient("LmStudio", client =>
{
    var baseUrl = builder.Configuration["LmStudio:BaseUrl"]
        ?? "http://127.0.0.1:1234/v1/";

    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(90);
});

builder.Services.AddHttpClient("GitActivity", client =>
{
    var baseUrl =
        builder.Configuration["GitActivity:BaseUrl"]
        ?? "https://activity.kgivler.com/";

    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(5);
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

var app = builder.Build();
app.ConfigurePipeline(builder.Environment);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGitActivityRoutes();
app.MapCodeReviewRoutes();
app.MapSteamRoutes();
app.MapBbsRoutes();
app.MapTelemetryRoutes();

app.Run();
