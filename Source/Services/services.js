(() => {
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

  if (!filterInput) {
    return;
  }

  function applyFilter() {
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

  filterInput.addEventListener(
    "input",
    applyFilter
  );
})();
