import { API_CONFIG } from "../js/config.js";

(() => {
  const fleetUrl = `${API_CONFIG.TELEMETRY}/api/services/hosts`;
  const refreshIntervalMilliseconds = 60_000;
  const requestTimeoutMilliseconds = 8_000;

  const filterInput = document.getElementById("service-filter");
  const serviceEntries = Array.from(
    document.querySelectorAll("[data-service-entry]")
  );
  const serviceSummaries = serviceEntries
    .map((entry) => entry.querySelector("summary"))
    .filter(Boolean);
  const serviceSections = Array.from(
    document.querySelectorAll("[data-service-section]")
  );
  const emptyState = document.getElementById("services-empty");

  const dashboard = {
    runningContainers: document.querySelector(
      "[data-live-running-containers]"
    ),
    banner: document.querySelector("[data-live-banner]"),
    summary: document.querySelector("[data-live-status-summary]"),
    node: document.querySelector("[data-live-node]"),
    capturedAt: document.querySelector("[data-live-captured-at]"),
    age: document.querySelector("[data-live-age]"),
    freshness: document.querySelector("[data-live-freshness]"),
    lastRefresh: document.querySelector("[data-live-last-refresh]"),
    publishStatus: document.querySelector("[data-live-publish-status]"),
    publishAt: document.querySelector("[data-live-publish-at]"),
    refreshButton: document.querySelector("[data-live-refresh]"),
    hostSelect: document.querySelector("[data-live-host-select]"),
    tableBody: document.querySelector("[data-live-table-body]"),
  };

  const liveServiceEntries = serviceEntries.filter(
    (entry) =>
      entry.dataset.nodeId &&
      (entry.dataset.containerName || entry.dataset.protocolService)
  );

  let refreshTimerId = null;
  let activeController = null;
  let refreshInFlight = null;
  let hosts = [];
  let selectedNodeId = null;
  const lastKnownSnapshots = new Map();
  const lastSuccessfulRefreshByNode = new Map();

  function normalizeNodeId(value) {
    return (value ?? "").trim().toLowerCase();
  }

  function applyFilter() {
    if (!filterInput) {
      return;
    }

    const query = filterInput.value.trim().toLowerCase();
    let visibleCount = 0;

    for (const entry of serviceEntries) {
      const searchText = entry.dataset.search?.toLowerCase() ?? "";
      const matches = query.length === 0 || searchText.includes(query);
      entry.hidden = !matches;

      if (matches) {
        visibleCount += 1;
      }
    }

    for (const section of serviceSections) {
      const hasVisibleEntry = Array.from(
        section.querySelectorAll("[data-service-entry]")
      ).some((entry) => !entry.hidden);
      section.hidden = !hasVisibleEntry;
    }

    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? "block" : "none";
    }
  }

  function normalizeContainerState(value) {
    return (value ?? "").trim().toLowerCase();
  }

  function isRunningState(value) {
    return normalizeContainerState(value) === "running";
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "Unavailable";
    }

    if (bytes === 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    const fractionDigits =
      value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? `${value.toFixed(2)}%` : "Unavailable";
  }

  function formatTimestamp(value) {
    if (!value) {
      return "Unavailable";
    }

    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime())
      ? "Unavailable"
      : timestamp.toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "medium",
        });
  }

  function formatAgeSeconds(value) {
    if (!Number.isFinite(value) || value < 0) {
      return "Unavailable";
    }

    if (value < 60) {
      return `${Math.floor(value)}s`;
    }

    const minutes = Math.floor(value / 60);
    if (minutes < 60) {
      return `${minutes}m ${Math.floor(value % 60)}s`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ${minutes % 60}m`;
    }

    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }

  function setChipState(chip, text, type) {
    if (!chip) {
      return;
    }

    chip.textContent = text;
    chip.dataset.type = type;
  }

  function setBannerState(state, summaryText) {
    if (dashboard.banner) {
      dashboard.banner.dataset.state = state;
    }

    if (dashboard.summary) {
      dashboard.summary.textContent = summaryText;
    }
  }

  function setDashboardBusy(isBusy) {
    dashboard.banner?.setAttribute("aria-busy", isBusy ? "true" : "false");
    if (dashboard.refreshButton) {
      dashboard.refreshButton.disabled = isBusy;
    }
  }

  function formatChipLabel(label, options = {}) {
    return options.lastKnown ? `LAST KNOWN: ${label}` : label;
  }

  function buildProtocolMap(protocols) {
    return new Map((protocols ?? []).map((item) => [item.service, item]));
  }

  function buildContainerMap(containers) {
    return new Map((containers ?? []).map((item) => [item.name, item]));
  }

  function renderContainerTable(snapshot, options = {}) {
    if (!dashboard.tableBody) {
      return;
    }

    const containers = Array.isArray(snapshot?.containers)
      ? [...snapshot.containers]
      : [];
    containers.sort((left, right) => left.name.localeCompare(right.name));
    dashboard.tableBody.replaceChildren();

    if (containers.length === 0) {
      renderTableMessage("No containers were included in the latest snapshot.");
      return;
    }

    for (const container of containers) {
      const row = document.createElement("tr");
      const normalizedState = normalizeContainerState(container.state);
      const nameCell = document.createElement("td");
      const code = document.createElement("code");
      code.textContent = container.name ?? "Unknown";
      nameCell.append(code);

      const stateCell = document.createElement("td");
      const chip = document.createElement("span");
      chip.className = "service-chip";
      setChipState(
        chip,
        formatChipLabel((normalizedState || "unknown").toUpperCase(), options),
        options.lastKnown || snapshot.stale
          ? "warning"
          : isRunningState(normalizedState)
            ? "running"
            : "unhealthy"
      );
      stateCell.append(chip);

      const memoryCell = document.createElement("td");
      memoryCell.textContent = formatBytes(container.memoryUsageBytes);
      const memoryPercentCell = document.createElement("td");
      memoryPercentCell.textContent = formatPercent(container.memoryPercent);
      const cpuCell = document.createElement("td");
      cpuCell.textContent = formatPercent(container.cpuPercent);
      const restartsCell = document.createElement("td");
      restartsCell.textContent = Number.isFinite(container.restartCount)
        ? String(container.restartCount)
        : "Unavailable";

      row.append(
        nameCell,
        stateCell,
        memoryCell,
        memoryPercentCell,
        cpuCell,
        restartsCell
      );
      dashboard.tableBody.append(row);
    }
  }

  function renderTableMessage(message) {
    if (!dashboard.tableBody) {
      return;
    }

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = message;
    row.append(cell);
    dashboard.tableBody.replaceChildren(row);
  }

  function renderDashboardSummary(snapshot, host, options = {}) {
    const containers = Array.isArray(snapshot?.containers)
      ? snapshot.containers
      : [];
    const runningContainers = containers.filter((container) =>
      isRunningState(container.state)
    ).length;

    if (dashboard.runningContainers) {
      dashboard.runningContainers.textContent = String(runningContainers);
    }
    if (dashboard.node) {
      dashboard.node.textContent = host.displayName;
    }
    if (dashboard.capturedAt) {
      dashboard.capturedAt.textContent = formatTimestamp(snapshot.capturedAt);
    }
    if (dashboard.age) {
      dashboard.age.textContent = formatAgeSeconds(snapshot.ageSeconds);
    }
    if (dashboard.freshness) {
      dashboard.freshness.textContent = options.lastKnown
        ? "UNAVAILABLE"
        : snapshot.stale
          ? "STALE"
          : "FRESH";
    }
    if (dashboard.lastRefresh) {
      dashboard.lastRefresh.textContent = formatTimestamp(
        lastSuccessfulRefreshByNode.get(normalizeNodeId(host.nodeId))
      );
    }
    if (dashboard.publishStatus) {
      dashboard.publishStatus.textContent =
        snapshot.missionControlPublishSucceeded === true
          ? "SUCCEEDED"
          : snapshot.missionControlPublishSucceeded === false
            ? "FAILED"
            : "UNKNOWN";
    }
    if (dashboard.publishAt) {
      dashboard.publishAt.textContent = formatTimestamp(
        snapshot.lastMissionControlPublishAttemptAt
      );
    }

    const protocols = Array.isArray(snapshot?.protocols) ? snapshot.protocols : [];
    const healthyProtocols = protocols.filter(
      (protocol) => protocol.succeeded === true
    ).length;
    const freshnessLabel = snapshot.stale ? "STALE" : "FRESH";

    if (options.lastKnown) {
      setBannerState(
        "unavailable",
        `[UNAVAILABLE] ${host.displayName} could not be refreshed. Showing its most recent successful snapshot.`
      );
      return;
    }

    setBannerState(
      snapshot.stale ? "stale" : "healthy",
      `[${freshnessLabel}] ${host.displayName} reported ${runningContainers} running container${
        runningContainers === 1 ? "" : "s"
      } and ${healthyProtocols}/${protocols.length} healthy protocol probe${
        protocols.length === 1 ? "" : "s"
      }.`
    );
  }

  function renderServiceEntries(snapshot, nodeId, options = {}) {
    const selectedNode = normalizeNodeId(nodeId);
    const containerMap = buildContainerMap(snapshot?.containers);
    const protocolMap = buildProtocolMap(snapshot?.protocols);

    for (const entry of liveServiceEntries) {
      const chip = entry.querySelector("[data-live-status]");
      const memoryValue = entry.querySelector("[data-live-memory]");
      const containerStateValue = entry.querySelector(
        "[data-live-container-state]"
      );
      const protocolLatencyValue = entry.querySelector(
        "[data-live-protocol-latency]"
      );

      if (normalizeNodeId(entry.dataset.nodeId) !== selectedNode) {
        setChipState(chip, "OTHER HOST", "unavailable");
        if (memoryValue) memoryValue.textContent = "Not on selected host";
        if (containerStateValue) containerStateValue.textContent = "Not on selected host";
        if (protocolLatencyValue) protocolLatencyValue.textContent = "Not on selected host";
        continue;
      }

      const container = entry.dataset.containerName
        ? containerMap.get(entry.dataset.containerName)
        : null;
      const protocol = entry.dataset.protocolService
        ? protocolMap.get(entry.dataset.protocolService)
        : null;

      if (memoryValue) {
        memoryValue.textContent = container
          ? formatBytes(container.memoryUsageBytes)
          : "Unavailable";
      }
      if (containerStateValue) {
        containerStateValue.textContent = container
          ? (normalizeContainerState(container.state) || "unknown").toUpperCase()
          : "Unavailable";
      }
      if (protocolLatencyValue) {
        protocolLatencyValue.textContent = protocol
          ? protocol.succeeded
            ? `${protocol.durationMilliseconds} ms${
                options.lastKnown ? " (last known)" : ""
              }${snapshot.stale ? " (stale snapshot)" : ""}`
            : `Probe failed${options.lastKnown ? " (last known)" : ""}${
                snapshot.stale ? " (stale snapshot)" : ""
              }`
          : "No recent probe";
      }

      if (protocol && chip) {
        const label = protocol.succeeded ? "HEALTHY" : "UNHEALTHY";
        setChipState(
          chip,
          formatChipLabel(label, options),
          options.lastKnown || snapshot.stale
            ? "warning"
            : protocol.succeeded
              ? "healthy"
              : "unhealthy"
        );
      } else if (container && chip) {
        const state = normalizeContainerState(container.state) || "unknown";
        setChipState(
          chip,
          formatChipLabel(state.toUpperCase(), options),
          options.lastKnown || snapshot.stale
            ? "warning"
            : isRunningState(state)
              ? "running"
              : "unhealthy"
        );
      } else {
        setChipState(chip, "UNAVAILABLE", "unavailable");
      }
    }
  }

  function renderSnapshot(host, snapshot, options = {}) {
    renderDashboardSummary(snapshot, host, options);
    renderContainerTable(snapshot, options);
    renderServiceEntries(snapshot, host.nodeId, options);
  }

  function renderUnavailableServiceEntries(nodeId) {
    const selectedNode = normalizeNodeId(nodeId);

    for (const entry of liveServiceEntries) {
      const isSelected = normalizeNodeId(entry.dataset.nodeId) === selectedNode;
      setChipState(
        entry.querySelector("[data-live-status]"),
        isSelected ? "UNAVAILABLE" : "OTHER HOST",
        "unavailable"
      );

      const replacement = isSelected ? "Unavailable" : "Not on selected host";
      const memoryValue = entry.querySelector("[data-live-memory]");
      const stateValue = entry.querySelector("[data-live-container-state]");
      const protocolValue = entry.querySelector("[data-live-protocol-latency]");
      if (memoryValue) memoryValue.textContent = replacement;
      if (stateValue) stateValue.textContent = replacement;
      if (protocolValue) protocolValue.textContent = replacement;
    }
  }

  function renderSelectedHost() {
    const host = hosts.find(
      (item) => normalizeNodeId(item.nodeId) === normalizeNodeId(selectedNodeId)
    );

    if (!host) {
      renderNoHosts();
      return;
    }

    const key = normalizeNodeId(host.nodeId);
    if (host.available && host.snapshot) {
      renderSnapshot(host, host.snapshot);
      return;
    }

    const lastKnown = lastKnownSnapshots.get(key);
    if (lastKnown) {
      renderSnapshot(host, lastKnown, { lastKnown: true });
      return;
    }

    if (dashboard.runningContainers) dashboard.runningContainers.textContent = "—";
    if (dashboard.node) dashboard.node.textContent = host.displayName;
    if (dashboard.capturedAt) dashboard.capturedAt.textContent = "Unavailable";
    if (dashboard.age) dashboard.age.textContent = "Unavailable";
    if (dashboard.freshness) dashboard.freshness.textContent = "UNAVAILABLE";
    if (dashboard.lastRefresh) dashboard.lastRefresh.textContent = "Never";
    if (dashboard.publishStatus) dashboard.publishStatus.textContent = "UNAVAILABLE";
    if (dashboard.publishAt) dashboard.publishAt.textContent = "Unavailable";

    renderUnavailableServiceEntries(host.nodeId);
    renderTableMessage(
      `${host.displayName} is currently unavailable. Static service details remain visible above.`
    );
    setBannerState(
      "unavailable",
      `[UNAVAILABLE] ${host.displayName} could not be reached through Kgivler.Api. Other hosts remain selectable.`
    );
  }

  function renderNoHosts() {
    if (dashboard.runningContainers) dashboard.runningContainers.textContent = "—";
    if (dashboard.node) dashboard.node.textContent = "Unavailable";
    if (dashboard.capturedAt) dashboard.capturedAt.textContent = "Unavailable";
    if (dashboard.age) dashboard.age.textContent = "Unavailable";
    if (dashboard.freshness) dashboard.freshness.textContent = "UNAVAILABLE";
    if (dashboard.publishStatus) dashboard.publishStatus.textContent = "UNAVAILABLE";
    if (dashboard.publishAt) dashboard.publishAt.textContent = "Unavailable";
    renderUnavailableServiceEntries("");
    renderTableMessage(
      "No Mission Control hosts are configured. Static service details remain visible above."
    );
    setBannerState(
      "unavailable",
      "[UNAVAILABLE] No Mission Control hosts are currently configured."
    );
  }

  function renderFleetUnavailable() {
    renderNoHosts();
    renderTableMessage(
      "Live Mission Control data could not be loaded. Static service details remain visible above."
    );
    setBannerState(
      "unavailable",
      "[UNAVAILABLE] The configured Mission Control hosts could not be loaded through Kgivler.Api."
    );

    if (dashboard.hostSelect) {
      const option = document.createElement("option");
      option.textContent = "Hosts unavailable";
      dashboard.hostSelect.replaceChildren(option);
      dashboard.hostSelect.disabled = true;
    }
  }

  function updateHostSelector(nextHosts) {
    hosts = nextHosts;
    const previousSelection = normalizeNodeId(selectedNodeId);
    const preservedHost = hosts.find(
      (host) => normalizeNodeId(host.nodeId) === previousSelection
    );
    const preferredHost =
      preservedHost ??
      hosts.find((host) => normalizeNodeId(host.nodeId) === "clanker") ??
      hosts[0] ??
      null;
    selectedNodeId = preferredHost?.nodeId ?? null;

    if (!dashboard.hostSelect) {
      return;
    }

    dashboard.hostSelect.replaceChildren();
    if (hosts.length === 0) {
      const option = document.createElement("option");
      option.textContent = "No configured hosts";
      dashboard.hostSelect.append(option);
      dashboard.hostSelect.disabled = true;
      return;
    }

    for (const host of hosts) {
      const option = document.createElement("option");
      option.value = host.nodeId;
      option.textContent = host.displayName;
      dashboard.hostSelect.append(option);
    }

    dashboard.hostSelect.value = selectedNodeId;
    dashboard.hostSelect.disabled = false;
  }

  function applyFleetResponse(fleet) {
    const refreshedAt = new Date().toISOString();

    for (const host of fleet.hosts) {
      if (host.available && host.snapshot) {
        const key = normalizeNodeId(host.nodeId);
        lastKnownSnapshots.set(key, host.snapshot);
        lastSuccessfulRefreshByNode.set(key, refreshedAt);
      }
    }

    updateHostSelector(fleet.hosts);
    renderSelectedHost();
  }

  function isValidTimestamp(value) {
    return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
  }

  function isFiniteNonNegativeNumber(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function isNullableNumber(value) {
    return value === null || Number.isFinite(value);
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function validateProtocol(protocol) {
    return Boolean(
      protocol &&
        isNonEmptyString(protocol.service) &&
        typeof protocol.succeeded === "boolean" &&
        isFiniteNonNegativeNumber(protocol.durationMilliseconds)
    );
  }

  function validateContainer(container) {
    return Boolean(
      container &&
        isNonEmptyString(container.name) &&
        typeof container.state === "string" &&
        isNullableNumber(container.memoryUsageBytes) &&
        isNullableNumber(container.memoryLimitBytes) &&
        isNullableNumber(container.memoryPercent) &&
        isNullableNumber(container.cpuPercent) &&
        isNullableNumber(container.restartCount)
    );
  }

  function validateSnapshot(snapshot) {
    return Boolean(
      snapshot &&
        isValidTimestamp(snapshot.capturedAt) &&
        isFiniteNonNegativeNumber(snapshot.ageSeconds) &&
        typeof snapshot.stale === "boolean" &&
        (snapshot.missionControlPublishSucceeded === null ||
          typeof snapshot.missionControlPublishSucceeded === "boolean") &&
        (snapshot.lastMissionControlPublishAttemptAt === null ||
          isValidTimestamp(snapshot.lastMissionControlPublishAttemptAt)) &&
        Array.isArray(snapshot.protocols) &&
        snapshot.protocols.every(validateProtocol) &&
        Array.isArray(snapshot.containers) &&
        snapshot.containers.every(validateContainer)
    );
  }

  function validateHost(host) {
    return Boolean(
      host &&
        isNonEmptyString(host.nodeId) &&
        isNonEmptyString(host.displayName) &&
        typeof host.available === "boolean" &&
        isNonEmptyString(host.status) &&
        (host.available ? validateSnapshot(host.snapshot) : host.snapshot === null)
    );
  }

  function validateFleet(fleet) {
    return Boolean(
      fleet &&
        isValidTimestamp(fleet.generatedAt) &&
        Array.isArray(fleet.hosts) &&
        fleet.hosts.every(validateHost)
    );
  }

  async function fetchFleet() {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    activeController?.abort();
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort(new Error("Request timed out."));
    }, requestTimeoutMilliseconds);

    activeController = controller;
    setDashboardBusy(true);

    const request = fetch(fleetUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Services request failed with ${response.status}.`);
        }
        return response.json();
      })
      .then((fleet) => {
        if (!validateFleet(fleet)) {
          throw new Error("Services payload did not match the expected contract.");
        }
        applyFleetResponse(fleet);
      })
      .catch((error) => {
        if (controller.signal.aborted && !didTimeout) {
          return;
        }
        console.warn("Unable to refresh Mission Control hosts.", error);
        const selected = hosts.find(
          (host) => normalizeNodeId(host.nodeId) === normalizeNodeId(selectedNodeId)
        );
        const lastKnown = selected
          ? lastKnownSnapshots.get(normalizeNodeId(selected.nodeId))
          : null;

        if (selected && lastKnown) {
          renderSnapshot(selected, lastKnown, { lastKnown: true });
        } else if (selected) {
          renderSelectedHost();
          setBannerState(
            "unavailable",
            `[UNAVAILABLE] ${selected.displayName} could not be refreshed through Kgivler.Api.`
          );
        } else {
          renderFleetUnavailable();
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (activeController === controller) activeController = null;
        if (refreshInFlight === request) {
          refreshInFlight = null;
          setDashboardBusy(false);
        }
      });

    refreshInFlight = request;
    return refreshInFlight;
  }

  function startPolling() {
    if (refreshTimerId === null) {
      refreshTimerId = window.setInterval(
        () => void fetchFleet(),
        refreshIntervalMilliseconds
      );
    }
  }

  function stopPolling() {
    if (refreshTimerId !== null) {
      window.clearInterval(refreshTimerId);
      refreshTimerId = null;
    }
  }

  function handlePageHide() {
    stopPolling();
    activeController?.abort();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      handlePageHide();
      return;
    }
    startPolling();
    void fetchFleet();
  }

  if (filterInput) {
    filterInput.addEventListener("input", applyFilter);
    applyFilter();
  }

  for (const summary of serviceSummaries) {
    summary.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      summary.parentElement.open = !summary.parentElement.open;
    });
  }

  dashboard.hostSelect?.addEventListener("change", () => {
    selectedNodeId = dashboard.hostSelect.value;
    renderSelectedHost();
  });
  dashboard.refreshButton?.addEventListener("click", () => void fetchFleet());
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      startPolling();
      void fetchFleet();
    }
  });
  document.addEventListener("visibilitychange", handleVisibilityChange);

  startPolling();
  void fetchFleet();
})();
