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
using Kgivler.Api.CodeReview;


var builder = WebApplication.CreateBuilder(args);

// BBS Database
var schema = @"
            CREATE TABLE IF NOT EXISTS Messages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Author TEXT,
                Content TEXT,
                Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );";

var connectionString = SqliteHelper.InitializeSqlite("kgivler_com.db", schema);

builder.Services.AddApplicationServices(connectionString, builder.Environment);

// TODO: clean this up some more

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
});

// HttpClient for LM Studio
builder.Services.AddHttpClient("LmStudio", client =>
{
    var baseUrl = builder.Configuration["LmStudio:BaseUrl"]
        ?? "http://127.0.0.1:1234/v1/";

    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(90);
});

var app = builder.Build();
app.ConfigurePipeline(builder.Environment);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// ----------------------- Routes -----------------------

// TODO: Clean this up, split up routes into separate files

// LM Studio / QwenCoder Health Check
app.MapGet("/api/code-review/health", async (
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    var configuredModel = configuration["LmStudio:Model"]
        ?? "qwen2.5-coder-3b-instruct@q6_k";

    var lmStudio = httpClientFactory.CreateClient("LmStudio");

    using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    timeoutCts.CancelAfter(TimeSpan.FromSeconds(5));

    try
    {
        var response = await lmStudio.GetAsync("models", timeoutCts.Token);

        if (!response.IsSuccessStatusCode)
        {
            return Results.Problem(
                title: "LM Studio is reachable, but returned an error.",
                detail: $"Status {(int)response.StatusCode}",
                statusCode: StatusCodes.Status502BadGateway);
        }

        var models = await response.Content.ReadFromJsonAsync<LmStudioModelsResponse>(
            cancellationToken: timeoutCts.Token);

        var modelAvailable = models?.Data?.Any(model =>
            string.Equals(model.Id, configuredModel, StringComparison.OrdinalIgnoreCase)) ?? false;

        return Results.Ok(new
        {
            status = "ok",
            lmStudioReachable = true,
            configuredModel,
            modelAvailable
        });
    }
    catch (OperationCanceledException)
    {
        return Results.Problem(
            title: "LM Studio health check timed out.",
            detail: "Make sure the LM Studio server is running.",
            statusCode: StatusCodes.Status504GatewayTimeout);
    }
    catch (HttpRequestException ex)
    {
        logger.LogWarning(ex, "Could not reach LM Studio.");

        return Results.Problem(
            title: "Could not reach LM Studio.",
            detail: "Make sure LM Studio is running with the local server enabled.",
            statusCode: StatusCodes.Status502BadGateway);
    }
}).RequireRateLimiting("CodeReviewPolicy");


// QwenCoder Code Review
app.MapPost("/api/code-review", async (
    CodeReviewRequest request,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    var code = request.Code?.Trim();

    if (string.IsNullOrWhiteSpace(code))
    {
        return Results.BadRequest(new
        {
            title = "Paste some code first."
        });
    }

    const int maxCodeChars = 12_000;

    if (code.Length > maxCodeChars)
    {
        return Results.BadRequest(new
        {
            title = $"Code is too large. Keep it under {maxCodeChars:N0} characters."
        });
    }

    var model = configuration["LmStudio:Model"]
        ?? "qwen2.5-coder-3b-instruct@q6_k";

    var lmStudio = httpClientFactory.CreateClient("LmStudio");

    var lmRequest = new LmStudioChatRequest
    {
        Model = model,
        Temperature = 0.15,
        MaxTokens = 900,
        Stream = false,
        Messages =
        [
            new LmStudioMessage
            {
                Role = "system",
                Content = """
                You are QwenCoder running a concise code review for Kyle's personal website.

                Review the code like a practical senior C#, JavaScript, and web developer.

                Focus on:
                - actual bugs
                - security problems
                - performance problems
                - error handling
                - readability
                - concrete fixes

                Do not rewrite the entire file unless necessary.
                Be direct, useful, and concise.
                Use short headings and bullet points.
                """
            },
            new LmStudioMessage
            {
                Role = "user",
                Content = $"""
                Language hint: {request.Language ?? "auto"}

                Review this code:

                ```text
                {code}
                ```
                """
            }
        ]
    };

    using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    timeoutCts.CancelAfter(TimeSpan.FromSeconds(90));

    try
    {
        var response = await lmStudio.PostAsJsonAsync(
            "chat/completions",
            lmRequest,
            timeoutCts.Token);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(timeoutCts.Token);

            logger.LogWarning(
                "LM Studio returned {StatusCode}: {Error}",
                response.StatusCode,
                error);

            return Results.Problem(
                title: "LM Studio returned an error.",
                detail: $"Status {(int)response.StatusCode}",
                statusCode: StatusCodes.Status502BadGateway);
        }

        var lmResponse = await response.Content.ReadFromJsonAsync<LmStudioChatResponse>(
            cancellationToken: timeoutCts.Token);

        var review = lmResponse?
            .Choices?
            .FirstOrDefault()?
            .Message?
            .Content?
            .Trim();

        if (string.IsNullOrWhiteSpace(review))
        {
            return Results.Problem(
                title: "LM Studio returned an empty review.",
                statusCode: StatusCodes.Status502BadGateway);
        }

        return Results.Ok(new CodeReviewResponse(review));
    }
    catch (OperationCanceledException)
    {
        return Results.Problem(
            title: "Code review timed out.",
            detail: "LM Studio took too long to respond.",
            statusCode: StatusCodes.Status504GatewayTimeout);
    }
    catch (HttpRequestException ex)
    {
        logger.LogWarning(ex, "Could not reach LM Studio.");

        return Results.Problem(
            title: "Could not reach LM Studio.",
            detail: "Make sure LM Studio is running and the local server is enabled.",
            statusCode: StatusCodes.Status502BadGateway);
    }
}).RequireRateLimiting("CodeReviewPolicy");

// Get the last 5 BBS messages
app.MapGet("/api/bbs", async (SqliteConnection db, ILogger<Program> logger) =>
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
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred while fetching messages.");
        return Results.Problem("An error occurred while fetching messages.");
    }

    return Results.Ok(messages);
});

// Post a new BBS message
app.MapPost("/api/bbs", async (Message msg, SqliteConnection db, ILogger<Program> logger) =>
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
        logger.LogError("An error occurred while fetching messages: {ex}", ex);
        return Results.Problem("An error occurred while saving your message.");
    }
}).RequireRateLimiting("BbsPolicy");

// System Telemetry
app.MapGet("/api/system/usage", async (HttpContext context, SqliteConnection db) =>
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
    var hitResults = await HitCountHelper.ProcessHitCounts(db, ip);
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