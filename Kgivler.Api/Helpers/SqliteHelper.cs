/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using Microsoft.Data.Sqlite;

namespace Kgivler.Api.Helpers;

internal static class SqliteHelper
{
    internal static string InitializeSqlite()
    {
        // Sqlite Configuration
        var baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
        var dataFolder = Path.Combine(baseDirectory, "Data");
        Directory.CreateDirectory(dataFolder);

        var dbPath = Path.Combine(dataFolder, "kgivler_com.db"); // TODO appsettings
        var connectionString = $"Data Source={dbPath};Mode=ReadWriteCreate;Cache=Shared;";

        using var connection = new SqliteConnection(connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText = @"
            CREATE TABLE IF NOT EXISTS Visitors (
                IpAddress TEXT PRIMARY KEY,
                Hits INTEGER DEFAULT 1,
                LastSeen TEXT
            );
            CREATE TABLE IF NOT EXISTS Messages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Author TEXT,
                Content TEXT,
                Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );";
        command.ExecuteNonQuery();

        return connectionString;
    }
}