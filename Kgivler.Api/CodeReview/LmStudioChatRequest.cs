/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using System.Text.Json.Serialization;

namespace Kgivler.Api.CodeReview;

public sealed class LmStudioChatRequest
{
    [JsonPropertyName("model")]
    public required string Model { get; init; }

    [JsonPropertyName("messages")]
    public required List<LmStudioMessage> Messages { get; init; }

    [JsonPropertyName("temperature")]
    public double Temperature { get; init; } = 0.15;

    [JsonPropertyName("max_tokens")]
    public int MaxTokens { get; init; } = 900;

    [JsonPropertyName("stream")]
    public bool Stream { get; init; }
}

public sealed class LmStudioChatResponse
{
    [JsonPropertyName("choices")]
    public List<LmStudioChoice>? Choices { get; init; }
}