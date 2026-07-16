(() => {
  const snapshotUrl =
    "https://status-api.kgivler.com/api/snapshot";

  const refreshIntervalMilliseconds =
    60_000;

  const requestTimeoutMilliseconds =
    7_000;

  const filterInput =
    document.getElementById("service-filter");

  const serviceEntries = Array.from(
    document.querySelectorAll("[data-service-entry]")
  );

  const serviceSections = Array.from(
    document.querySelectorAll("[data-service-section]")
  );

  const emptyState =
    document.getElementById("services-empty");

  const dashboard = {
    runningContainers:
      document.querySelector(
        "[data-live-running-containers]"
      ),
    banner: document.querySelector(
      "[data-live-banner]"
    ),
    summary: document.querySelector(
      "[data-live-status-summary]"
    ),
    node: document.querySelector(
      "[data-live-node]"
    ),
    capturedAt:
      document.querySelector(
        "[data-live-captured-at]"
      ),
    age: document.querySelector(
      "[data-live-age]"
    ),
    freshness:
      document.querySelector(
        "[data-live-freshness]"
      ),
    lastRefresh:
      document.querySelector(
        "[data-live-last-refresh]"
      ),
    refreshButton:
      document.querySelector(
        "[data-live-refresh]"
      ),
    tableBody:
      document.querySelector(
        "[data-live-table-body]"
      ),
  };

  const liveServiceEntries =
    serviceEntries.filter(
      (entry) =>
        entry.dataset.containerName ||
        entry.dataset.protocolService
    );

  let refreshTimerId = null;
  let activeController = null;
  let refreshInFlight = null;
  let lastRenderedSnapshot = null;
  let lastSuccessfulRefreshAt = null;

  function applyFilter() {
    if (!filterInput) {
      return;
    }

    const query = filterInput.value
      .trim()
      .toLowerCase();

    let visibleCount = 0;

    for (const entry of serviceEntries) {
      const searchText =
        entry.dataset.search?.toLowerCase() ?? "";

      const matches =
        query.length === 0 ||
        searchText.includes(query);

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
      emptyState.style.display =
        visibleCount === 0
          ? "block"
          : "none";
    }
  }

  function normalizeContainerState(value) {
    return (value ?? "")
      .trim()
      .toLowerCase();
  }

  function isRunningState(value) {
    return (
      normalizeContainerState(value) ===
      "running"
    );
  }

  function formatBytes(bytes) {
    if (
      !Number.isFinite(bytes) ||
      bytes < 0
    ) {
      return "Unavailable";
    }

    if (bytes === 0) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
      "TB",
    ];

    let unitIndex = 0;
    let value = bytes;

    while (
      value >= 1024 &&
      unitIndex < units.length - 1
    ) {
      value /= 1024;
      unitIndex += 1;
    }

    const fractionDigits =
      value >= 100 || unitIndex === 0
        ? 0
        : value >= 10
          ? 1
          : 2;

    return `${value.toFixed(
      fractionDigits
    )} ${units[unitIndex]}`;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "Unavailable";
    }

    return `${value.toFixed(2)}%`;
  }

  function formatTimestamp(value) {
    if (!value) {
      return "Unavailable";
    }

    const timestamp = new Date(value);

    if (Number.isNaN(timestamp.getTime())) {
      return "Unavailable";
    }

    return timestamp.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  }

  function formatAgeSeconds(value) {
    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      return "Unavailable";
    }

    if (value < 60) {
      return `${Math.floor(value)}s`;
    }

    const minutes =
      Math.floor(value / 60);

    if (minutes < 60) {
      const seconds =
        Math.floor(value % 60);
      return `${minutes}m ${seconds}s`;
    }

    const hours =
      Math.floor(minutes / 60);
    const remainingMinutes =
      minutes % 60;

    if (hours < 24) {
      return `${hours}h ${remainingMinutes}m`;
    }

    const days =
      Math.floor(hours / 24);
    const remainingHours =
      hours % 24;

    return `${days}d ${remainingHours}h`;
  }

  function setChipState(
    chip,
    text,
    type
  ) {
    if (!chip) {
      return;
    }

    chip.textContent = text;
    chip.dataset.type = type;
  }

  function setBannerState(
    state,
    summaryText
  ) {
    if (dashboard.banner) {
      dashboard.banner.dataset.state =
        state;
    }

    if (dashboard.summary) {
      dashboard.summary.textContent =
        summaryText;
    }
  }

  function setDashboardBusy(isBusy) {
    if (dashboard.banner) {
      dashboard.banner.setAttribute(
        "aria-busy",
        isBusy ? "true" : "false"
      );
    }

    if (dashboard.refreshButton) {
      dashboard.refreshButton.disabled =
        isBusy;
    }
  }

  function formatChipLabel(
    label,
    options = {}
  ) {
    return options.lastKnown
      ? `LAST KNOWN: ${label}`
      : label;
  }

  function buildProtocolMap(protocols) {
    return new Map(
      (protocols ?? []).map((protocol) => [
        protocol.service,
        protocol,
      ])
    );
  }

  function buildContainerMap(containers) {
    return new Map(
      (containers ?? []).map((container) => [
        container.name,
        container,
      ])
    );
  }

  function renderContainerTable(
    snapshot,
    options = {}
  ) {
    if (!dashboard.tableBody) {
      return;
    }

    const containers = Array.isArray(
      snapshot?.containers
    )
      ? [...snapshot.containers]
      : [];

    containers.sort((left, right) =>
      left.name.localeCompare(right.name)
    );

    dashboard.tableBody.replaceChildren();

    if (containers.length === 0) {
      const row =
        document.createElement("tr");
      const cell =
        document.createElement("td");

      cell.colSpan = 6;
      cell.textContent =
        "No containers were included in the latest snapshot.";

      row.append(cell);
      dashboard.tableBody.append(row);
      return;
    }

    for (const container of containers) {
      const row =
        document.createElement("tr");
      const normalizedState =
        normalizeContainerState(
          container.state
        );
      const isRunning =
        isRunningState(normalizedState);

      const nameCell =
        document.createElement("td");
      const code =
        document.createElement("code");
      code.textContent =
        container.name ?? "Unknown";
      nameCell.append(code);

      const stateCell =
        document.createElement("td");
      const chip =
        document.createElement("span");
      chip.className = "service-chip";
      setChipState(
        chip,
        formatChipLabel(
          (
            normalizedState ||
            "unknown"
          ).toUpperCase(),
          options
        ),
        options.lastKnown ||
          snapshot.stale
          ? "warning"
          : isRunning
            ? "running"
            : "unhealthy"
      );
      stateCell.append(chip);

      const memoryCell =
        document.createElement("td");
      memoryCell.textContent =
        formatBytes(
          container.memoryUsageBytes
        );

      const memoryPercentCell =
        document.createElement("td");
      memoryPercentCell.textContent =
        formatPercent(
          container.memoryPercent
        );

      const cpuCell =
        document.createElement("td");
      cpuCell.textContent =
        formatPercent(
          container.cpuPercent
        );

      const restartsCell =
        document.createElement("td");
      restartsCell.textContent =
        Number.isFinite(
          container.restartCount
        )
          ? String(
              container.restartCount
            )
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

  function renderDashboardSummary(snapshot) {
    const containers = Array.isArray(
      snapshot?.containers
    )
      ? snapshot.containers
      : [];

    const runningContainers =
      containers.filter((container) =>
        isRunningState(container.state)
      ).length;

    if (dashboard.runningContainers) {
      dashboard.runningContainers.textContent =
        String(runningContainers);
    }

    if (dashboard.node) {
      dashboard.node.textContent =
        snapshot?.node || "Unavailable";
    }

    if (dashboard.capturedAt) {
      dashboard.capturedAt.textContent =
        formatTimestamp(
          snapshot?.capturedAt
        );
    }

    if (dashboard.age) {
      dashboard.age.textContent =
        formatAgeSeconds(
          snapshot?.ageSeconds
        );
    }

    if (dashboard.freshness) {
      dashboard.freshness.textContent =
        snapshot?.stale
          ? "STALE"
          : "FRESH";
    }

    if (dashboard.lastRefresh) {
      dashboard.lastRefresh.textContent =
        formatTimestamp(
          lastSuccessfulRefreshAt
        );
    }

    const protocolCount = Array.isArray(
      snapshot?.protocols
    )
      ? snapshot.protocols.length
      : 0;

    const healthyProtocols = (
      snapshot?.protocols ?? []
    ).filter(
      (protocol) =>
        protocol.succeeded === true
    ).length;

    const freshnessLabel =
      snapshot?.stale
        ? "STALE"
        : "FRESH";

    setBannerState(
      snapshot?.stale
        ? "stale"
        : "healthy",
      `[${freshnessLabel}] ${
        snapshot?.node || "Mission Control"
      } reported ${runningContainers} running container${
        runningContainers === 1
          ? ""
          : "s"
      } and ${healthyProtocols}/${protocolCount} healthy protocol probe${
        protocolCount === 1
          ? ""
          : "s"
      }.`
    );
  }

  function renderServiceEntries(
    snapshot,
    options = {}
  ) {
    const containerMap =
      buildContainerMap(
        snapshot?.containers
      );
    const protocolMap =
      buildProtocolMap(
        snapshot?.protocols
      );

    for (const entry of liveServiceEntries) {
      const containerName =
        entry.dataset.containerName;
      const protocolService =
        entry.dataset.protocolService;
      const container =
        containerName
          ? containerMap.get(
              containerName
            )
          : null;
      const protocol =
        protocolService
          ? protocolMap.get(
              protocolService
            )
          : null;

      const chip =
        entry.querySelector(
          "[data-live-status]"
        );
      const memoryValue =
        entry.querySelector(
          "[data-live-memory]"
        );
      const containerStateValue =
        entry.querySelector(
          "[data-live-container-state]"
        );
      const protocolLatencyValue =
        entry.querySelector(
          "[data-live-protocol-latency]"
        );

      if (memoryValue) {
        memoryValue.textContent =
          container
            ? formatBytes(
                container.memoryUsageBytes
              )
            : "Unavailable";
      }

      if (containerStateValue) {
        containerStateValue.textContent =
          container
            ? (
                normalizeContainerState(
                  container.state
                ) || "unknown"
              ).toUpperCase()
            : "Unavailable";
      }

      if (protocolLatencyValue) {
        if (protocol) {
          protocolLatencyValue.textContent =
            protocol.succeeded
              ? `${protocol.durationMilliseconds} ms${
                  options.lastKnown
                    ? " (last known)"
                    : ""
                }${
                  snapshot.stale
                    ? " (stale snapshot)"
                    : ""
                }`
              : `Probe failed${
                  options.lastKnown
                    ? " (last known)"
                    : ""
                }${
                  snapshot.stale
                    ? " (stale snapshot)"
                    : ""
                }`;
        } else {
          protocolLatencyValue.textContent =
            "No recent probe";
        }
      }

      if (protocol && chip) {
        const label =
          protocol.succeeded
            ? "HEALTHY"
            : "UNHEALTHY";

        if (snapshot.stale) {
          setChipState(
            chip,
            formatChipLabel(
              label,
              options
            ),
            "warning"
          );
        } else {
          setChipState(
            chip,
            formatChipLabel(
              label,
              options
            ),
            options.lastKnown
              ? "warning"
              : protocol.succeeded
                ? "healthy"
                : "unhealthy"
          );
        }

        continue;
      }

      if (container && chip) {
        const running =
          isRunningState(
            container.state
          );
        const label =
          (
            normalizeContainerState(
              container.state
            ) || "unknown"
          ).toUpperCase();

        setChipState(
          chip,
          formatChipLabel(
            label,
            options
          ),
          options.lastKnown ||
            snapshot.stale
            ? "warning"
            : running
              ? "running"
              : "unhealthy"
        );
      } else if (chip) {
        setChipState(
          chip,
          formatChipLabel(
            "UNAVAILABLE",
            options
          ),
          "unavailable"
        );
      }
    }
  }

  function renderSnapshot(snapshot) {
    lastRenderedSnapshot = snapshot;
    lastSuccessfulRefreshAt =
      new Date().toISOString();

    renderDashboardSummary(snapshot);
    renderContainerTable(snapshot);
    renderServiceEntries(snapshot);
  }

  function renderUnavailableState(error) {
    console.warn(
      "Unable to refresh Mission Control snapshot.",
      error
    );

    if (dashboard.lastRefresh) {
      dashboard.lastRefresh.textContent =
        formatTimestamp(
          lastSuccessfulRefreshAt
        );
    }

    if (!lastRenderedSnapshot) {
      if (dashboard.node) {
        dashboard.node.textContent =
          "Unavailable";
      }

      if (dashboard.capturedAt) {
        dashboard.capturedAt.textContent =
          "Unavailable";
      }

      if (dashboard.age) {
        dashboard.age.textContent =
          "Unavailable";
      }

      if (dashboard.freshness) {
        dashboard.freshness.textContent =
          "UNAVAILABLE";
      }

      setBannerState(
        "unavailable",
        "[UNAVAILABLE] Live Mission Control data could not be loaded. Static service details remain available."
      );

      return;
    }

    if (dashboard.freshness) {
      dashboard.freshness.textContent =
        "UNAVAILABLE";
    }

    renderContainerTable(
      lastRenderedSnapshot,
      { lastKnown: true }
    );
    renderServiceEntries(
      lastRenderedSnapshot,
      { lastKnown: true }
    );

    setBannerState(
      "unavailable",
      "[UNAVAILABLE] Showing the most recent successful snapshot. A new refresh attempt failed."
    );
  }

  function isValidTimestamp(value) {
    return (
      typeof value === "string" &&
      !Number.isNaN(
        new Date(value).getTime()
      )
    );
  }

  function isFiniteNonNegativeNumber(value) {
    return (
      Number.isFinite(value) &&
      value >= 0
    );
  }

  function isNonEmptyString(value) {
    return (
      typeof value === "string" &&
      value.trim().length > 0
    );
  }

  function validateProtocol(protocol) {
    return Boolean(
      protocol &&
        isNonEmptyString(
          protocol.service
        ) &&
        typeof protocol.succeeded ===
          "boolean" &&
        isFiniteNonNegativeNumber(
          protocol.durationMilliseconds
        )
    );
  }

  function validateContainer(container) {
    return Boolean(
      container &&
        isNonEmptyString(container.name) &&
        typeof container.state ===
          "string" &&
        isFiniteNonNegativeNumber(
          container.memoryUsageBytes
        ) &&
        isFiniteNonNegativeNumber(
          container.memoryLimitBytes
        ) &&
        Number.isFinite(
          container.memoryPercent
        ) &&
        Number.isFinite(
          container.cpuPercent
        ) &&
        isFiniteNonNegativeNumber(
          container.restartCount
        )
    );
  }

  function validateSnapshotShape(snapshot) {
    return Boolean(
      snapshot &&
        typeof snapshot.node ===
          "string" &&
        isValidTimestamp(
          snapshot.capturedAt
        ) &&
        isFiniteNonNegativeNumber(
          snapshot.ageSeconds
        ) &&
        typeof snapshot.stale ===
          "boolean" &&
        Array.isArray(snapshot.protocols) &&
        snapshot.protocols.every(
          validateProtocol
        ) &&
        Array.isArray(snapshot.containers) &&
        snapshot.containers.every(
          validateContainer
        )
    );
  }

  async function fetchSnapshot() {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    activeController?.abort();

    const controller =
      new AbortController();
    let didTimeout = false;
    const timeoutId =
      window.setTimeout(() => {
        didTimeout = true;
        controller.abort(
          new Error("Request timed out.")
        );
      }, requestTimeoutMilliseconds);

    activeController = controller;
    setDashboardBusy(true);

    refreshInFlight = fetch(
      snapshotUrl,
      {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Snapshot request failed with ${response.status}.`
          );
        }

        return response.json();
      })
      .then((snapshot) => {
        if (
          !validateSnapshotShape(
            snapshot
          )
        ) {
          throw new Error(
            "Snapshot payload did not match the expected contract."
          );
        }

        renderSnapshot(snapshot);
      })
      .catch((error) => {
        if (
          controller.signal.aborted &&
          !didTimeout
        ) {
          return;
        }

        renderUnavailableState(error);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);

        if (activeController === controller) {
          activeController = null;
        }

        refreshInFlight = null;
        setDashboardBusy(false);
      });

    return refreshInFlight;
  }

  function startPolling() {
    if (refreshTimerId !== null) {
      return;
    }

    refreshTimerId = window.setInterval(
      () => {
        void fetchSnapshot();
      },
      refreshIntervalMilliseconds
    );
  }

  function stopPolling() {
    if (refreshTimerId !== null) {
      window.clearInterval(
        refreshTimerId
      );
      refreshTimerId = null;
    }
  }

  function handlePageHide(event) {
    stopPolling();
    activeController?.abort();

  }

  function handlePageShow(event) {
    if (!event.persisted) {
      return;
    }

    startPolling();
    void fetchSnapshot();
  }

  if (filterInput) {
    filterInput.addEventListener(
      "input",
      applyFilter
    );
    applyFilter();
  }

  dashboard.refreshButton?.addEventListener(
    "click",
    () => {
      void fetchSnapshot();
    }
  );

  window.addEventListener(
    "pagehide",
    handlePageHide
  );

  window.addEventListener(
    "pageshow",
    handlePageShow
  );

  startPolling();
  void fetchSnapshot();
})();
