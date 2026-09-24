/*
 * kgivler_com
 *
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

namespace Kgivler.Api.ServicesStatus;

public sealed record ServicesFleetResponse(
    DateTimeOffset GeneratedAt,
    IReadOnlyList<ServicesHostResponse> Hosts);

public sealed record ServicesHostResponse(
    string NodeId,
    string DisplayName,
    bool Available,
    string Status,
    ServicesSnapshotResponse? Snapshot,
    string? Message);

public sealed record ServicesSnapshotResponse(
    DateTimeOffset CapturedAt,
    long AgeSeconds,
    bool Stale,
    ServicesHostMetricResponse? Host,
    bool? MissionControlPublishSucceeded,
    DateTimeOffset? LastMissionControlPublishAttemptAt,
    IReadOnlyList<ServicesProtocolResponse> Protocols,
    IReadOnlyList<ServicesContainerResponse> Containers,
    bool? DockerAvailable);

public sealed record ServicesHostMetricResponse(
    int LogicalProcessorCount,
    double? CpuPercent,
    long? MemoryTotalBytes,
    long? MemoryAvailableBytes,
    double? LoadAverage1Minute,
    double? LoadAverage5Minutes,
    double? LoadAverage15Minutes);

public sealed record ServicesProtocolResponse(
    string Service,
    bool Succeeded,
    long DurationMilliseconds);

public sealed record ServicesContainerResponse(
    string Name,
    string State,
    long? MemoryUsageBytes,
    long? MemoryLimitBytes,
    double? MemoryPercent,
    double? CpuPercent,
    int? RestartCount);

internal sealed record AgentSnapshotTransport(
    string? Node,
    string? NodeId,
    DateTimeOffset CapturedAt,
    long AgeSeconds,
    bool Stale,
    AgentHostMetricTransport? Host,
    bool? MissionControlPublishSucceeded,
    DateTimeOffset? LastMissionControlPublishAttemptAt,
    IReadOnlyList<AgentProtocolTransport>? Protocols,
    IReadOnlyList<AgentContainerTransport>? Containers,
    bool? DockerAvailable);

internal sealed record AgentHostMetricTransport(
    int LogicalProcessorCount,
    double? CpuPercent,
    long? MemoryTotalBytes,
    long? MemoryAvailableBytes,
    double? LoadAverage1Minute,
    double? LoadAverage5Minutes,
    double? LoadAverage15Minutes);

internal sealed record AgentProtocolTransport(
    string? Service,
    bool Succeeded,
    long DurationMilliseconds);

internal sealed record AgentContainerTransport(
    string? Name,
    string? State,
    long? MemoryUsageBytes,
    long? MemoryLimitBytes,
    double? MemoryPercent,
    double? CpuPercent,
    int? RestartCount);
