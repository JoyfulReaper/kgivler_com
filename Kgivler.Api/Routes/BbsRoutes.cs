/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Kgivler.Api.Bbs;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;

namespace Kgivler.Api.Routes;

public static class BbsRoutes
{
    public static WebApplication MapBbsRoutes(this WebApplication app)
    {
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

        app.MapPost("/api/bbs", async (Message msg, SqliteConnection db, ILogger<Program> logger) =>
        {
            try
            {
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

        return app;
    }
}
