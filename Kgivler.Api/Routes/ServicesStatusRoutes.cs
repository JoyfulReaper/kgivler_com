/*
 * kgivler_com
 *
 * Copyright (c) 2026 Kyle Givler
 * Licensed under the MIT License.
 */

using System.Net.Http.Json;
using Kgivler.Api.ServicesStatus;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Kgivler.Api.Routes;

public static class ServicesStatusRoutes
{
    private const string CacheKey = "services-status-fleet";
    private static readonly SemaphoreSlim RefreshLock = new(1, 1);

    public static WebApplication MapServicesStatusRoutes(
        this WebApplication app)
    {
        app.MapGet(
            "/api/services/hosts",
            async (
                IHttpClientFactory httpClientFactory,
                IOptions<ServicesStatusOptions> optionsAccessor,
                IMemoryCache cache,
                ILogger<Program> logger,
                CancellationToken cancellationToken) =>
            {
                ServicesFleetResponse response =
                    await GetFleetAsync(
                        httpClientFactory,
                        optionsAccessor.Value,
                        cache,
                        logger,
                        cancellationToken);

                return Results.Ok(response);
            })
            .RequireRateLimiting("TelemetryPolicy");

        return app;
    }

    private static async Task<ServicesFleetResponse> GetFleetAsync(
        IHttpClientFactory httpClientFactory,
        ServicesStatusOptions options,
        IMemoryCache cache,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        if (cache.TryGetValue(
                CacheKey,
                out ServicesFleetResponse? cached) &&
            cached is not null)
        {
            return cached;
        }

        await RefreshLock.WaitAsync(cancellationToken);

        try
        {
            if (cache.TryGetValue(
                    CacheKey,
                    out cached) &&
                cached is not null)
            {
                return cached;
            }

            ServicesStatusHostOptions[] hosts = options.Hosts
                .Where(host =>
                    !string.IsNullOrWhiteSpace(host.NodeId) &&
                    !string.IsNullOrWhiteSpace(host.DisplayName))
                .DistinctBy(
                    host => host.NodeId.Trim(),
                    StringComparer.OrdinalIgnoreCase)
                .ToArray();

            Task<ServicesHostResponse>[] requests = hosts
                .Select(host => QueryHostAsync(
                    host,
                    httpClientFactory,
                    logger,
                    cancellationToken))
                .ToArray();

            ServicesHostResponse[] results =
                await Task.WhenAll(requests);

            var response = new ServicesFleetResponse(
                DateTimeOffset.UtcNow,
                results);

            cache.Set(
                CacheKey,
                response,
                TimeSpan.FromSeconds(
                    Math.Clamp(options.CacheSeconds, 5, 60)));

            return response;
        }
        finally
        {
            RefreshLock.Release();
        }
    }

    private static async Task<ServicesHostResponse> QueryHostAsync(
        ServicesStatusHostOptions host,
        IHttpClientFactory httpClientFactory,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        string nodeId = host.NodeId.Trim();
        string displayName = host.DisplayName.Trim();

        if (!TryCreateSnapshotUri(host.BaseUrl, out Uri? snapshotUri))
        {
            logger.LogError(
                "Services status BaseUrl is invalid for node {NodeId}.",
                nodeId);

            return Unavailable(
                nodeId,
                displayName,
                "Agent configuration is unavailable.");
        }

        try
        {
            HttpClient client = httpClientFactory.CreateClient(
                "ServicesStatusAgents");

            using HttpResponseMessage response =
                await client.GetAsync(snapshotUri, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Services status Agent {NodeId} returned {StatusCode}.",
                    nodeId,
                    response.StatusCode);

                return Unavailable(
                    nodeId,
                    displayName,
                    "Agent is currently unavailable.");
            }

            AgentSnapshotTransport? snapshot =
                await response.Content.ReadFromJsonAsync<AgentSnapshotTransport>(
                    cancellationToken);

            if (snapshot is null)
            {
                logger.LogWarning(
                    "Services status Agent {NodeId} returned an empty snapshot.",
                    nodeId);

                return Unavailable(
                    nodeId,
                    displayName,
                    "Agent did not return a usable snapshot.");
            }

            if (snapshot.CapturedAt == default || snapshot.AgeSeconds < 0)
            {
                logger.LogWarning(
                    "Services status Agent {NodeId} returned an invalid snapshot contract.",
                    nodeId);

                return Unavailable(
                    nodeId,
                    displayName,
                    "Agent did not return a usable snapshot.");
            }

            // Node is a display/legacy name, not a stable identity. Current
            // Agents emit NodeId; accept its absence only for compatibility
            // with older Agent payloads that predate that property.
            if (!string.IsNullOrWhiteSpace(snapshot.NodeId) &&
                !string.Equals(
                    snapshot.NodeId.Trim(),
                    nodeId,
                    StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning(
                    "Services status Agent configured as {NodeId} reported unexpected stable node {ReportedNodeId}; rejecting snapshot.",
                    nodeId,
                    snapshot.NodeId);

                return Unavailable(
                    nodeId,
                    displayName,
                    "Agent identity could not be verified.");
            }

            ServicesProtocolResponse[] protocols =
                (snapshot.Protocols ?? [])
                    .Where(protocol =>
                        !string.IsNullOrWhiteSpace(protocol.Service))
                    .Select(protocol =>
                        new ServicesProtocolResponse(
                            protocol.Service!.Trim(),
                            protocol.Succeeded,
                            Math.Max(0, protocol.DurationMilliseconds)))
                    .ToArray();

            ServicesContainerResponse[] containers =
                (snapshot.Containers ?? [])
                    .Where(container =>
                        !string.IsNullOrWhiteSpace(container.Name))
                    .Select(container =>
                        new ServicesContainerResponse(
                            container.Name!.Trim(),
                            container.State?.Trim() ?? "unknown",
                            container.MemoryUsageBytes,
                            container.MemoryLimitBytes,
                            container.MemoryPercent,
                            container.CpuPercent,
                            container.RestartCount))
                    .ToArray();

            ServicesHostMetricResponse? hostMetric = snapshot.Host is null
                ? null
                : new ServicesHostMetricResponse(
                    snapshot.Host.LogicalProcessorCount,
                    snapshot.Host.CpuPercent,
                    snapshot.Host.MemoryTotalBytes,
                    snapshot.Host.MemoryAvailableBytes,
                    snapshot.Host.LoadAverage1Minute,
                    snapshot.Host.LoadAverage5Minutes,
                    snapshot.Host.LoadAverage15Minutes);

            var projection = new ServicesSnapshotResponse(
                snapshot.CapturedAt,
                Math.Max(0, snapshot.AgeSeconds),
                snapshot.Stale,
                hostMetric,
                snapshot.MissionControlPublishSucceeded,
                snapshot.LastMissionControlPublishAttemptAt,
                protocols,
                containers,
                snapshot.DockerAvailable);

            return new ServicesHostResponse(
                nodeId,
                displayName,
                true,
                snapshot.Stale ? "stale" : "available",
                projection,
                null);
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning(
                "Services status Agent {NodeId} timed out.",
                nodeId);

            return Unavailable(
                nodeId,
                displayName,
                "Agent request timed out.");
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(
                exception,
                "Could not reach services status Agent {NodeId}.",
                nodeId);

            return Unavailable(
                nodeId,
                displayName,
                "Agent is currently unavailable.");
        }
        catch (System.Text.Json.JsonException exception)
        {
            logger.LogWarning(
                exception,
                "Services status Agent {NodeId} returned invalid JSON.",
                nodeId);

            return Unavailable(
                nodeId,
                displayName,
                "Agent did not return a usable snapshot.");
        }
        catch (Exception exception)
        {
            logger.LogError(
                exception,
                "Unexpected services status failure for Agent {NodeId}.",
                nodeId);

            return Unavailable(
                nodeId,
                displayName,
                "Agent is currently unavailable.");
        }
    }

    private static bool TryCreateSnapshotUri(
        string baseUrl,
        out Uri? snapshotUri)
    {
        snapshotUri = null;

        if (!Uri.TryCreate(
                baseUrl?.Trim(),
                UriKind.Absolute,
                out Uri? parsed) ||
            (parsed.Scheme != Uri.UriSchemeHttp &&
             parsed.Scheme != Uri.UriSchemeHttps))
        {
            return false;
        }

        return Uri.TryCreate(
            $"{parsed.AbsoluteUri.TrimEnd('/')}/api/snapshot",
            UriKind.Absolute,
            out snapshotUri);
    }

    private static ServicesHostResponse Unavailable(
        string nodeId,
        string displayName,
        string message) =>
        new(
            nodeId,
            displayName,
            false,
            "unavailable",
            null,
            message);
}
