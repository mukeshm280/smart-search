import {
  OPERATORS,
  applyFilters,
  createBooleanFilter,
  createSelectFilter,
  highlight,
} from "./utility.js";

/**
 * SmartSearch Web Component
 * A reusable,framework agnostic, customizable search component with advanced filtering capabilities.
 * Features:
 * - Flexible data handling with support for various data structures and dynamic updates
 * - Advanced filtering with multiple filter types (select, boolean, range) and combinable filters
 * - Search term highlighting in results for better visibility
 * - Keyboard navigation support for accessibility and improved user experience
 * - Click-outside dismissal for intuitive interaction
 * - Style isolation using Shadow DOM and support for light/dark themes
 * - Custom events to communicate with parent applications and allow for flexible integration
 */
class SmartSearch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); // Enable Shadow DOM for style encapsulation

    this.data = []; // to hold active search results
    this.searchResults = []; // to hold the full set of search results before filtering
    this.selectedIndex = -1;
    this.isOpen = false;
    this.activeFilters = {}; // Track all active filters
    this.debounceTimer = null; // For input debouncing
    this.eventController = new AbortController();
    this.handlers = {}; // Store event handlers for cleanup
    this.config = {
      placeholder: "Search...",
      dataSource: [],
      filters: [],
    };
  }

  /**
   * Lifecycle method called when the component is added to the DOM.
   * Initializes the component by rendering the UI,
   * setting up event listeners,
   * and initializing filters based on the provided configuration.
   */
  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.initFilters();
  }

  /**
   * Observed attributes for the component.
   */
  static get observedAttributes() {
    return ["placeholder", "theme", "config"];
  }

  /**
   * Called when an observed attribute changes.
   * @param {string} name
   * @param {string} oldValue
   * @param {string} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "config" && newValue) {
      this.config = JSON.parse(newValue);
      console.log("Parsed config:", this.config);
      // this.initFilters();
    }
  }

  //  Style isolation and custom theming support
  render() {
    const theme = this.getAttribute("theme") || "light";
    const isDark = theme === "dark";

    this.shadowRoot.innerHTML = `
        <style>
            :host {
                --bg: ${isDark ? "#2c3e50" : "#ffffff"};
                --text: ${isDark ? "#ecf0f1" : "#333333"};
                --border: ${isDark ? "#455a64" : "#dcdfe6"};
                --hover: ${isDark ? "#34495e" : "#f5f7fa"};
                --highlight: #0066cc;
                display: block;
                position: relative;
                width: 100%;
            }

            .search-wrapper { position: relative; width: 100%; }

            input {
                width: 100%;
                padding: 12px 65px 12px 15px;
                font-size: 16px;
                border: 2px solid var(--border);
                border-radius: 8px;
                background: var(--bg);
                color: var(--text);
                box-sizing: border-box;
                transition: border-color 0.2s;
                outline: none;
            }

            input:focus { border-color: var(--highlight); }

            /* Clear Button Styles */
            #clearBtn {
                position: absolute;
                right: 12px;
                top: 45px;
                background: #bdc3c7;
                color: white;
                border: none;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                cursor: pointer;
                display: none; /* Hidden by default */
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }

            #clearBtn.visible { display: flex; }
            #clearBtn:hover { background: #95a5a6; }

            /* Loader Styles */
            .loader {
                position: absolute;
                right: 38px;
                top: 47px;
                width: 14px;
                height: 14px;
                border: 2px solid var(--border);
                border-top: 2px solid var(--highlight);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                display: none;
                pointer-events: none;
            }
            .loader.visible { display: block; }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* Overlay Management */
            .dropdown {
                position: absolute;
                top: calc(100% + 5px);
                left: 0;
                right: 0;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                max-height: 300px;
                overflow-y: auto;
                display: none;
                z-index: 1;
            }

            .dropdown.open { display: block; }

            .filters { 
                margin-top: 8px; 
                display: none; 
                gap: 8px; 
                flex-wrap: wrap; 
                align-items: center;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: 6px;
                padding: 6px;
            }
            .filters.visible { display: flex; }
            
            /* Filter Item Styling */
            .filter-item {
                display: flex;
                align-items: center;
                gap: 4px;
                background: inherit;
            }
            
            .filter-item label {
                font-size: 12px;
                color: var(--text);
                font-weight: 500;
                white-space: nowrap;
            }
            
            .filter-item select {
                padding: 6px 8px;
                font-size: 12px;
                border: 1px solid var(--border);
                border-radius: 4px;
                background: var(--bg);
                color: var(--text);
                cursor: pointer;
                min-width: 80px;
                transition: border-color 0.2s, box-shadow 0.2s;
                outline: none;
            }
            
            .filter-item select:focus {
                border-color: var(--highlight);
                box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
            }
            
            .filter-item select:hover {
                border-color: var(--highlight);
            }

            .reset-filters-link {
                font-size: 12px;
                color: var(--highlight);
                margin-left: auto;
                text-decoration: underline;
                cursor: pointer;
            }
            .option-boolean-label {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
              color: var(--text);
            }
            
            .boolean-filter {
              display: flex;
            }
            
            .item {
                padding: 10px 15px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                border-bottom: 1px solid var(--border);
            }
            .search-label {
                font-size: 20px;
                display: block;
                margin-bottom: 8px;
            }  
            

            .item:last-child { border-bottom: none; }
            .item:hover, .item.active { background: var(--hover); }
            
            .item-label { font-weight: 600; font-size: 14px; color: var(--text); }
            .item-sub { font-size: 12px; color: #7f8c8d; margin-top: 2px; }

            .highlight-term { color: var(--highlight); text-decoration: underline; }

            /* Mobile Responsive */
            @media (max-width: 480px) {
                input { font-size: 18px; padding: 15px; }
            }
        </style>
        <div class="search-wrapper">
            <label for="searchInput" class="search-label">${this.getAttribute("label") || "Search"}</label>
            <input type="text" 
                   id="searchInput" 
                   placeholder="${this.getAttribute("placeholder") || "Search..."}"
                   autocomplete="off"
                   role="combobox"
                   aria-autocomplete="list"
                   aria-expanded="false"
                   aria-haspopup="listbox">
            <button id="clearBtn" aria-label="Clear search" title="Clear">×</button>
            <div id="loader" class="loader"></div>
            <div class="filters">
               <span style="font-size: 12px; color: var(--text); margin-right: 8px;">Filters:</span>
            </div>
            <div id="resultsList" class="dropdown" role="listbox"></div>
        </div>
        `;
  }

  setupEventListeners() {
    const input = this.shadowRoot.getElementById("searchInput");
    const clearBtn = this.shadowRoot.getElementById("clearBtn");
    const loader = this.shadowRoot.getElementById("loader");

    const signal = this.eventController.signal;

    // ---- Handlers ----
    this.handlers = {
      onInput: (e) => {
        clearTimeout(this.debounceTimer);
        const val = e.target.value;

        // Show loader immediately if there is text
        if (val.length > 0) loader.classList.add("visible");
        else loader.classList.remove("visible");

        this.debounceTimer = setTimeout(() => {
          clearBtn.classList.toggle("visible", val.length > 0);
          this.notifyParent("search-input", { value: val });
        }, 300);
      },

      onClear: () => {
        clearTimeout(this.debounceTimer);
        input.value = "";
        this.selectedIndex = -1;
        clearBtn.classList.remove("visible");
        loader.classList.remove("visible");
        this.close();
        input.focus();
        this.notifyParent("search-input", { value: "" });
      },

      onKeyDown: (e) => {
        const items = this.shadowRoot.querySelectorAll(".item");

        if (e.key === "ArrowDown") {
          e.preventDefault();
          this.selectedIndex = Math.min(
            this.selectedIndex + 1,
            items.length - 1,
          );
          this.updateActiveItem(items);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.updateActiveItem(items);
        } else if (e.key === "Enter") {
          if (this.selectedIndex >= 0)
            this.selectItem(this.data[this.selectedIndex]);
        } else if (e.key === "Escape") {
          this.close();
        }
      },

      onClickOutside: (e) => {
        if (!this.contains(e.target)) this.close();
      },
    };

    // ---- Bind using AbortController ----
    input.addEventListener("input", this.handlers.onInput, { signal });
    input.addEventListener("keydown", this.handlers.onKeyDown, { signal });
    clearBtn.addEventListener("click", this.handlers.onClear, { signal });
    document.addEventListener("click", this.handlers.onClickOutside, {
      signal,
    });
  }

  // ---------- FILTER UI ----------
  initFilters() {
    if (!this.config.filters.length) return;

    const container = this.shadowRoot.querySelector(".filters");
    container.innerHTML = `<span style="font-size: 12px; color: var(--text); margin-right: 8px;">Filters:</span>`;

    this.config.filters.forEach((filter) => {
      const wrapper = document.createElement("div");
      wrapper.className = "filter-item";

      const label = document.createElement("label");
      label.textContent = filter.label || filter.key;
      label.style.fontSize = "12px";
      label.style.marginRight = "6px";
      wrapper.appendChild(label);

      let el;

      if (filter.type === "select") {
        el = createSelectFilter.call(this, filter);
      } else if (filter.type === "boolean") {
        el = createBooleanFilter.call(this, filter);
      }

      if (el) {
        wrapper.appendChild(el);
        container.appendChild(wrapper);
      }
    });

    // add reset filters link
    const resetLink = document.createElement("a");
    resetLink.href = "#";
    resetLink.textContent = "Reset filters";
    resetLink.className = "reset-filters-link";
    resetLink.addEventListener("click", (event) => {
      event.preventDefault();
      this.resetFilters();
    });

    const resetWrapper = document.createElement("div");
    resetWrapper.style.marginLeft = "auto";
    resetWrapper.style.marginRight = "8px";
    resetWrapper.appendChild(resetLink);
    container.appendChild(resetWrapper);
  }

  resetFilters() {
    this.activeFilters = {};

    // Reset every filter control to default state
    const filterItems = this.shadowRoot.querySelectorAll(".filter-item");
    filterItems.forEach((item) => {
      const select = item.querySelector("select");
      if (select) select.value = "";

      const radios = item.querySelectorAll('input[type="radio"]');
      if (radios && radios.length) {
        radios.forEach((r) => {
          r.checked = r.value === "all";
        });
      }
    });

    // Reapply no filters
    this.applyAllFilters();
  }

  //  Handling flexible data structures
  updateResults(results, query, internalFilter = false) {
    const loader = this.shadowRoot.getElementById("loader");
    if (loader) loader.classList.remove("visible");

    if (!internalFilter) this.searchResults = results;
    this.data = results;
    this.selectedIndex = -1;
    const list = this.shadowRoot.getElementById("resultsList");
    const clearBtn = this.shadowRoot.getElementById("clearBtn");

    // Ensure clear button visibility matches current input state
    clearBtn.classList.toggle("visible", query.length > 0);

    if (!results.length) {
      // If search is empty (user cleared), close the dropdown
      if (!query) {
        this.close();
        return;
      }
      // Otherwise show "No results found" message
      list.innerHTML = `
        <div class="item" style="text-align: center; color: var(--border); padding: 20px; cursor: default;"> 
          <span class="item-label">No results found</span>
        </div>
      `;
      this.open();
      return;
    }

    list.innerHTML = results
      .map(
        (item, idx) => `
            <div class="item" data-index="${idx}" role="option">
                <span class="item-label">${highlight.call(this, item.label, query)}</span>
                <span class="item-sub">${item.category} • ${item.id} • ${item.active ? "Active" : "Inactive"}</span>
            </div>
        `,
      )
      .join("");

    this.open();

    list.querySelectorAll(".item").forEach((el) => {
      const signal = this.eventController.signal;
      el.addEventListener(
        "click",
        () => {
          const item = this.data[el.dataset.index];
          if (item) this.selectItem(item);
        },
        { signal },
      );
    });
  }

  updateActiveItem(items) {
    items.forEach((item, idx) => {
      item.classList.toggle("active", idx === this.selectedIndex);
      if (idx === this.selectedIndex) {
        item.scrollIntoView({ block: "nearest" });
        this.shadowRoot
          .getElementById("searchInput")
          .setAttribute("aria-activedescendant", `item-${idx}`);
      }
    });
  }

  selectItem(item) {
    const input = this.shadowRoot.getElementById("searchInput");
    const clearBtn = this.shadowRoot.getElementById("clearBtn");
    input.value = item.label;
    clearBtn.classList.add("visible");
    //  Notify parent of selection
    this.notifyParent("search-select", { item });
    this.close();
  }

  open() {
    this.isOpen = true;
    this.shadowRoot.getElementById("resultsList").classList.add("open");
    if (this.config.filters.length)
      this.shadowRoot.querySelector(".filters").classList.add("visible");
    this.shadowRoot
      .getElementById("searchInput")
      .setAttribute("aria-expanded", "true");
  }

  close() {
    this.isOpen = false;
    this.shadowRoot.getElementById("resultsList").classList.remove("open");
    this.shadowRoot.querySelector(".filters").classList.remove("visible");
    this.shadowRoot
      .getElementById("searchInput")
      .setAttribute("aria-expanded", "false");
  }

  filterData(key, value) {
    // Implementation for filtering data based on key-value pairs
    // If value is empty string, show all results (no filter applied)
    if (key === "" || value === null || value === undefined) {
      this.updateResults(
        this.searchResults,
        this.shadowRoot.getElementById("searchInput").value,
        true,
      );
      return;
    }

    const filtedData = this.searchResults.filter((item) => {
      const itemVal = item[key];
      const operatorName =
        this.config.filters.find((f) => f.key === key)?.operator || "equals";
      const operatorFunc = OPERATORS[operatorName];
      return operatorFunc(itemVal, value);
    });
    this.updateResults(
      filtedData,
      this.shadowRoot.getElementById("searchInput").value,
      true,
    );
  }

  updateFilterState(key, value) {
    // Update the active filters state
    if (value === null) {
      delete this.activeFilters[key];
    } else {
      this.activeFilters[key] = value;
    }
    // Apply all active filters
    this.applyAllFilters();
  }

  applyAllFilters() {
    const filteredData = applyFilters(
      this.searchResults,
      this.activeFilters,
      this.config.filters,
    );

    this.updateResults(
      filteredData,
      this.shadowRoot.getElementById("searchInput").value,
      true,
    );
  }

  /**
   * Utility method to dispatch custom events to the parent application.
   * @param {string} eventName - The name of the event to dispatch.
   * @param {object} detail - The data to include in the event's detail property.
   * This allows the parent application to listen for specific events and receive relevant data when they occur,
   * enabling flexible integration and communication between the component and its host environment.
   */
  notifyParent(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  /**
   * Lifecycle method called when the component is removed from the DOM.
   * Cleans up event listeners and any asynchronous work to prevent memory leaks.
   */
  disconnectedCallback() {
    // removes ALL listeners
    this.eventController.abort();
    // clear async work
    clearTimeout(this.debounceTimer);
  }
}

customElements.define("smart-search", SmartSearch);
