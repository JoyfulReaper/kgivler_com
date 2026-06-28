/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Microsoft.Data.Sqlite;

namespace Kgivler.Api.Helpers;

internal static class HitCountHelper
{
    internal async static Task<(long totalHits, long uniqueVisitors)> ProcessHitCounts(string connectionString, string ip)
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
}
