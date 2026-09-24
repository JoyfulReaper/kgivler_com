/*
 * kgivler_com
 *
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

namespace Kgivler.Api.ServicesStatus;

public sealed class ServicesStatusOptions
{
    public const string SectionName = "ServicesStatus";

    public int TimeoutSeconds { get; init; } = 5;

    public int CacheSeconds { get; init; } = 15;

    public List<ServicesStatusHostOptions> Hosts { get; init; } = [];
}

public sealed class ServicesStatusHostOptions
{
    public string NodeId { get; init; } = "";

    public string DisplayName { get; init; } = "";

    public string BaseUrl { get; init; } = "";
}
