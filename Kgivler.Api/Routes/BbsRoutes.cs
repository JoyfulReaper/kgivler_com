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
        app.MapGet("/api/bbs", async (SqliteConnection db,
            ILogger<Program> logger) =>
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

        app.MapPost("/api/bbs", async (Message msg,
            SqliteConnection db,
            IMissionControlClient missionControlClient,
            CancellationToken cancellationToken,
            ILogger<Program> logger) =>
        {
            var occurredAt = DateTimeOffset.UtcNow;
            var stopwatch = Stopwatch.StartNew();
            var correlationId = Guid.NewGuid().ToString("N");

            try
            {
                var originalContentLength = msg.Content.Length;
                var content = msg.Content.Length > 256 ? msg.Content[..256] : msg.Content;
                var escapedContent = System.Net.WebUtility.HtmlEncode(content);

                await db.OpenAsync();
                var messageCmd = db.CreateCommand();
                messageCmd.CommandText = "INSERT INTO Messages (Author, Content) VALUES ($author, $content);";
                messageCmd.Parameters.AddWithValue("$author", msg.Author);
                messageCmd.Parameters.AddWithValue("$content", escapedContent);

                await messageCmd.ExecuteNonQueryAsync();
                stopwatch.Stop();

                await missionControlClient.TryPublishAsync(
                    eventType: KgivlerEventTypes.BbsMessageCreated,
                    payload: new BbsMessageCreatedEvent(
                        AuthorLength: msg.Author?.Length ?? 0,
                        OriginalContentLength: originalContentLength,
                        StoredContentLength: content.Length,
                        ContentTruncated: originalContentLength > content.Length,
                        DurationMilliseconds: stopwatch.ElapsedMilliseconds),
                    occurredAt: occurredAt,
                    correlationId: correlationId,
                    cancellationToken: cancellationToken);

                return Results.Created("/api/bbs", new { status = "success", message = "Post received." });
            }
            catch (Exception ex)
            {
                logger.LogError("An error occurred while fetching messages: {ex}", ex);
                return Results.Problem("An error occurred while saving your message.");
            }
        }).RequireRateLimiting("BbsPolicy");

        return app;
    }
}
