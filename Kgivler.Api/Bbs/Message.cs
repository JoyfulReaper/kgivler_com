/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */


namespace Kgivler.Api.Bbs;

public record Message
{
    public int Id { get; init; }
    public string Content { get; init; } = "[NO MESSAGE]";
    public string Author { get; init; } = "[UNKNOWN]";
    public DateTime Timestamp { get; init; }
}