/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using JoyfulReaperLib.MissionControl;
using Kgivler.Api.Bbs;
using Kgivler.Api.Events;
using Microsoft.Data.Sqlite;
using System.Diagnostics;

namespace Kgivler.Api.Routes;

public static class BbsRoutes
{
    public static WebApplication MapBbsRoutes(this WebApplication app)
    {
        app.MapGet("/api/bbs", async (
            SqliteConnection db,
            ILogger<Program> logger,
            IMissionControlClient missionControlClient,
            CancellationToken cancellationToken) =>
        {
            var messages = new List<Message>();
            var occurredAt = DateTimeOffset.UtcNow;
            var stopwatch = Stopwatch.StartNew();
            var correlationId = Guid.NewGuid().ToString("N");

            try
            {
                await db.OpenAsync(cancellationToken);

                using var messageCmd = db.CreateCommand();
                messageCmd.CommandText = """
                    SELECT Id, Author, Content, Timestamp
                    FROM Messages
                    ORDER BY Timestamp DESC
                    LIMIT 5;
                    """;

                using var reader =
                    await messageCmd.ExecuteReaderAsync(cancellationToken);

                while (await reader.ReadAsync(cancellationToken))
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
            catch (OperationCanceledException)
                when (cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status499ClientClosedRequest);
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "An error occurred while fetching BBS messages.");

                return Results.Problem(
                    "An error occurred while fetching messages.");
            }

            stopwatch.Stop();

            try
            {
                await missionControlClient.TryPublishAsync(
                    eventType: KgivlerEventTypes.BbsMessagesRetrieved,
                    payload: new BbsMessagesShownEvent(
                        TotalMessagesShown: messages.Count,
                        DurationMilliseconds:
                            stopwatch.ElapsedMilliseconds),
                    occurredAt: occurredAt,
                    correlationId: correlationId,
                    cancellationToken: CancellationToken.None);
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Failed to publish BBS event {CorrelationId}.",
                    correlationId);
            }

            return Results.Ok(messages);
        });

        app.MapPost("/api/bbs", async (
            Message msg,
            SqliteConnection db,
            IMissionControlClient missionControlClient,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            var occurredAt = DateTimeOffset.UtcNow;
            var stopwatch = Stopwatch.StartNew();
            var correlationId = Guid.NewGuid().ToString("N");

            int originalContentLength;
            string content;

            try
            {
                originalContentLength = msg.Content.Length;
                content = originalContentLength > 256
                    ? msg.Content[..256]
                    : msg.Content;

                var escapedContent =
                    System.Net.WebUtility.HtmlEncode(content);

                await db.OpenAsync(cancellationToken);

                using var messageCmd = db.CreateCommand();
                messageCmd.CommandText = """
                    INSERT INTO Messages (Author, Content)
                    VALUES ($author, $content);
                    """;

                messageCmd.Parameters.AddWithValue(
                    "$author",
                    msg.Author);

                messageCmd.Parameters.AddWithValue(
                    "$content",
                    escapedContent);

                await messageCmd.ExecuteNonQueryAsync(
                    cancellationToken);
            }
            catch (OperationCanceledException)
                when (cancellationToken.IsCancellationRequested)
            {
                return Results.StatusCode(
                    StatusCodes.Status499ClientClosedRequest);
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "An error occurred while saving a BBS message.");

                return Results.Problem(
                    "An error occurred while saving your message.");
            }

            stopwatch.Stop();

            try
            {
                await missionControlClient.TryPublishAsync(
                    eventType: KgivlerEventTypes.BbsMessageCreated,
                    payload: new BbsMessageCreatedEvent(
                        AuthorLength: msg.Author?.Length ?? 0,
                        OriginalContentLength: originalContentLength,
                        StoredContentLength: content.Length,
                        ContentTruncated:
                            originalContentLength > content.Length,
                        DurationMilliseconds:
                            stopwatch.ElapsedMilliseconds),
                    occurredAt: occurredAt,
                    correlationId: correlationId,
                    cancellationToken: CancellationToken.None);
            }
            catch (Exception exception)
            {
                // Saving the message already succeeded. Telemetry must not
                // change the response into an error.
                logger.LogWarning(
                    exception,
                    "Failed to publish BBS event {CorrelationId}.",
                    correlationId);
            }

            return Results.Created(
                "/api/bbs",
                new
                {
                    status = "success",
                    message = "Post received."
                });
        }).RequireRateLimiting("BbsPolicy");

        return app;
    }
}