export function createBooleanFilter(filter) {
  const el = document.createElement("div");
  el.className = "boolean-filter";

  const values = ["all", "true", "false"];
  values.forEach((val) => {
    const optionContainer = document.createElement("label");
    optionContainer.className = "option-boolean-label";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `${filter.key}-radio`;
    radio.value = val;
    if (val === "all") radio.checked = true;

    const labelText = document.createTextNode(
      val === "all" ? "All" : val === "true" ? "True" : "False",
    );
    const signal = this.eventController.signal;

    radio.addEventListener(
      "change",
      (e) => {
        const val =
          e.target.value === "true"
            ? true
            : e.target.value === "false"
              ? false
              : null;

        this.updateFilterState(filter.key, val);
      },
      { signal },
    );

    optionContainer.appendChild(radio);
    optionContainer.appendChild(labelText);
    el.appendChild(optionContainer);
  });
  return el;
}

export function createSelectFilter(filter) {
  const el = document.createElement("select");
  el.innerHTML = `
      <option value="">All</option>
      ${filter.options
        .map((o) => `<option value="${filter.key} ${o}">${o}</option>`)
        .join("")}
    `;

  const signal = this.eventController.signal;
  el.addEventListener(
    "change",
    (e) => {
      if (e.target.value === "") {
        this.updateFilterState(filter.key, null);
      } else {
        const [key, value] = e.target.value.split(" ");
        this.updateFilterState(key, value);
      }
    },
    { signal },
  );
  return el;
}

export function highlight(text, term) {
  if (!term) return text;
  const regex = new RegExp(`(${term})`, "gi");
  return text.replace(regex, `<span class="highlight-term">$1</span>`);
}

export const OPERATORS = {
  equals: (itemVal, filterVal) => itemVal === filterVal,

  includes: (itemVal, filterVal) =>
    String(itemVal).toLowerCase().includes(filterVal.toLowerCase()),
};

/**
 * Core filtering logic moved to utility for pure data transformation.
 */
export function applyFilters(items, activeFilters, filterConfigs) {
  const activeFilterKeys = Object.keys(activeFilters);
  if (activeFilterKeys.length === 0) return items;

  return items.filter((item) => {
    return activeFilterKeys.every((key) => {
      const itemVal = item[key];
      const filterValue = activeFilters[key];
      const config = filterConfigs.find((f) => f.key === key);
      const operatorName = config?.operator || "equals";
      const operatorFunc = OPERATORS[operatorName];
      return operatorFunc ? operatorFunc(itemVal, filterValue) : true;
    });
  });
}
