/*
 * kgivler_com
 * 
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using System.Text.Json.Serialization;

namespace Kgivler.Api.CodeReview;

public sealed class LmStudioModel
{
    [JsonPropertyName("id")]
    public string? Id { get; init; }
}

public sealed class LmStudioMessage
{
    [JsonPropertyName("role")]
    public required string Role { get; init; }

    [JsonPropertyName("content")]
    public required string Content { get; init; }
}


public sealed class LmStudioChoice
{
    [JsonPropertyName("message")]
    public LmStudioMessage? Message { get; init; }
}

public sealed class LmStudioModelsResponse
{
    [JsonPropertyName("data")]
    public List<LmStudioModel>? Data { get; init; }
}