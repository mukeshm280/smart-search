import {
  applyFilters,
  createBooleanFilter,
  createSelectFilter,
  highlight,
} from "./utility.js";

/**
 * TEMPLATE DEFINITION
 * Defined outside the class so it is parsed once by the browser.
 */
const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
        --bg: #ffffff;
        --text: #333333;
        --border: #dcdfe6;
        --hover: #f5f7fa;
        --highlight: #0066cc;
        display: block;
        position: relative;
        width: 100%;
        font-family: system-ui, -apple-system, sans-serif;
    }

    /* Theme switching via attribute selector */
    :host([theme="dark"]) {
        --bg: #2c3e50;
        --text: #ecf0f1;
        --border: #455a64;
        --hover: #34495e;
    }

    .sr-only {
        position: absolute;
        width: 1px; height: 1px; padding: 0; margin: -1px;
        overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;
    }

    .search-wrapper { position: relative; width: 100%; }
    
    .search-label {
        font-size: 16px; font-weight: 600; display: block;
        margin-bottom: 8px; color: var(--text);
    }

    input {
        width: 100%; padding: 12px 65px 12px 15px;
        font-size: 16px; border: 2px solid var(--border);
        border-radius: 8px; background: var(--bg);
        color: var(--text); box-sizing: border-box;
        outline: none; transition: border-color 0.2s;
    }

    input:focus { border-color: var(--highlight); box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.2); }

    #clearBtn {
        position: absolute; right: 12px; top: 42px;
        background: #bdc3c7; color: white; border: none;
        border-radius: 50%; width: 24px; height: 24px;
        cursor: pointer; display: none; align-items: center;
        justify-content: center; font-size: 18px;
    }

    #clearBtn.visible { display: flex; }

    .loader {
        position: absolute; right: 42px; top: 47px;
        width: 14px; height: 14px;
        border: 2px solid var(--border);
        border-top: 2px solid var(--highlight);
        border-radius: 50%; animation: spin 0.8s linear infinite;
        display: none;
    }
    .loader.visible { display: block; }

    @keyframes spin { to { transform: rotate(360deg); } }

    .dropdown {
        position: absolute; top: calc(100% + 5px);
        left: 0; right: 0; background: var(--bg);
        border: 1px solid var(--border); border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        max-height: 300px; overflow-y: auto;
        display: none; z-index: 100;
    }
    .dropdown.open { display: block; }

    .filters { 
        margin-top: 8px; display: none; gap: 12px; 
        flex-wrap: wrap; align-items: center;
        background: var(--hover); border-radius: 6px; padding: 10px;
    }
    .filters.visible { display: flex; }

    .item {
        padding: 12px 15px; cursor: pointer;
        display: flex; flex-direction: column;
        border-bottom: 1px solid var(--border);
    }
    .item.active { background: var(--hover); border-left: 4px solid var(--highlight); }
    .item-label { font-weight: 600; font-size: 14px; color: var(--text); }
    .item-sub { font-size: 12px; color: #7f8c8d; margin-top: 4px; }
  </style>

  <div class="search-wrapper" role="none">
      <label id="searchLabel" for="searchInput" class="search-label"></label>
      <input type="text" 
             id="searchInput" 
             autocomplete="off" 
             role="combobox" 
             aria-autocomplete="list" 
             aria-expanded="false" 
             aria-haspopup="listbox"
             aria-controls="resultsList">
      
      <div id="status" class="sr-only" aria-live="polite" aria-atomic="true"></div>
      
      <button id="clearBtn" aria-label="Clear search">×</button>
      <div id="loader" class="loader" role="status" aria-label="Loading"></div>
      
      <div class="filters" role="group" aria-label="Search filters"></div>
      
      <div id="resultsList" 
           class="dropdown" 
           role="listbox" 
           aria-labelledby="searchLabel"></div>
  </div>
`;

/**
 * COMPONENT CLASS
 */
class SmartSearch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // Internal State
    this.searchResults = [];
    this.filteredResults = [];
    this.selectedIndex = -1;
    this.isOpen = false;
    this.activeFilters = {};
    this.debounceTimer = null;
    this.eventController = new AbortController();
    
    this.config = {
      placeholder: "Search...",
      filters: [],
    };
  }

  static get observedAttributes() {
    return ["placeholder", "label", "config", "theme"];
  }

  connectedCallback() {
    this.updateStaticContent();
    this.setupEventListeners();
    this.initFilters();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    if (name === "config" && newValue) {
      try {
        this.config = { ...this.config, ...JSON.parse(newValue) };
        this.initFilters();
      } catch (e) { console.error("Config parse error", e); }
    }

    this.updateStaticContent();
  }

  /**
   * Updates attributes like labels and placeholders without re-rendering HTML
   */
  updateStaticContent() {
    const input = this.shadowRoot.getElementById("searchInput");
    const label = this.shadowRoot.getElementById("searchLabel");
    
    if (input) input.placeholder = this.getAttribute("placeholder") || "Search...";
    if (label) label.textContent = this.getAttribute("label") || "Search";
  }

  setupEventListeners() {
    const input = this.shadowRoot.getElementById("searchInput");
    const clearBtn = this.shadowRoot.getElementById("clearBtn");
    const { signal } = this.eventController;

    input.addEventListener("input", (e) => this.handleInput(e), { signal });
    input.addEventListener("keydown", (e) => this.handleKeyDown(e), { signal });
    clearBtn.addEventListener("click", () => this.handleClear(), { signal });
    
    document.addEventListener("click", (e) => {
      if (!this.contains(e.composedPath()[0])) this.close();
    }, { signal });
  }

  handleInput(e) {
    const val = e.target.value;
    const loader = this.shadowRoot.getElementById("loader");
    
    if (val.length > 0) loader.classList.add("visible");
    
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.shadowRoot.getElementById("clearBtn").classList.toggle("visible", val.length > 0);
      this.notifyParent("search-input", { value: val });
    }, 300);
  }

  handleKeyDown(e) {
    const items = this.shadowRoot.querySelectorAll('.item[role="option"]');
    
    if (!this.isOpen && items.length > 0 && e.key === "ArrowDown") {
        this.open();
        return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
        this.updateActiveItem(items);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateActiveItem(items);
        break;
      case "Enter":
        if (this.selectedIndex >= 0) {
          e.preventDefault();
          this.selectItem(this.filteredResults[this.selectedIndex]);
        }
        break;
      case "Escape":
        this.close();
        break;
    }
  }

  handleClear() {
    const input = this.shadowRoot.getElementById("searchInput");
    input.value = "";
    this.selectedIndex = -1;
    this.shadowRoot.getElementById("clearBtn").classList.remove("visible");
    this.shadowRoot.getElementById("status").textContent = "Search cleared";
    this.close();
    input.focus();
    this.notifyParent("search-input", { value: "" });
  }

  initFilters() {
    const container = this.shadowRoot.querySelector(".filters");
    if (!this.config.filters || !this.config.filters.length) {
        container.classList.remove("visible");
        return;
    }

    container.innerHTML = `<span style="font-size: 12px; color: var(--text); font-weight:bold;">Filters:</span>`;

    this.config.filters.forEach((filter) => {
      const wrapper = document.createElement("div");
      wrapper.className = "filter-item";
      
      const label = document.createElement("label");
      const id = `f-${filter.key}`;
      label.textContent = filter.label || filter.key;
      label.setAttribute("for", id);
      label.style.fontSize = "12px";
      wrapper.appendChild(label);

      let el;
      if (filter.type === "select") el = createSelectFilter.call(this, filter);
      else if (filter.type === "boolean") el = createBooleanFilter.call(this, filter);

      if (el) {
        el.id = id;
        wrapper.appendChild(el);
        container.appendChild(wrapper);
      }
    });

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.className = "item-sub";
    resetBtn.style.cssText = "background:none; border:none; cursor:pointer; text-decoration:underline; color:var(--highlight);";
    resetBtn.onclick = () => this.resetFilters();
    container.appendChild(resetBtn);
  }

  updateResults(results, query, internalFilter = false) {
    const status = this.shadowRoot.getElementById("status");
    const list = this.shadowRoot.getElementById("resultsList");
    this.shadowRoot.getElementById("loader").classList.remove("visible");

    if (!internalFilter) this.searchResults = results;
    this.filteredResults = results;
    this.selectedIndex = -1;

    // Accessibility Announcement
    if (query) {
        status.textContent = results.length > 0 
            ? `${results.length} results available.` 
            : "No results found.";
    }

    if (!results.length) {
      if (!query) { this.close(); return; }
      list.innerHTML = `<div class="item" role="option" style="text-align:center;">No results found</div>`;
      this.open();
      return;
    }

    list.innerHTML = results.map((item, idx) => `
        <div class="item" id="opt-${idx}" data-index="${idx}" role="option" aria-selected="false">
            <span class="item-label">${highlight.call(this, item.label, query)}</span>
            <span class="item-sub">${item.category} • ${item.active ? "Active" : "Inactive"}</span>
        </div>
    `).join("");

    this.open();

    list.querySelectorAll(".item").forEach((el) => {
      el.addEventListener("click", () => {
        const item = this.filteredResults[el.dataset.index];
        if (item) this.selectItem(item);
      }, { signal: this.eventController.signal });
    });
  }

  updateActiveItem(items) {
    const input = this.shadowRoot.getElementById("searchInput");
    items.forEach((item, idx) => {
      const isActive = idx === this.selectedIndex;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", isActive);
      if (isActive) {
        input.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  selectItem(item) {
    const input = this.shadowRoot.getElementById("searchInput");
    input.value = item.label;
    this.shadowRoot.getElementById("status").textContent = `Selected ${item.label}`;
    this.notifyParent("search-select", { item });
    this.close();
  }

  open() {
    this.isOpen = true;
    this.shadowRoot.getElementById("resultsList").classList.add("open");
    if (this.config.filters.length) this.shadowRoot.querySelector(".filters").classList.add("visible");
    this.shadowRoot.getElementById("searchInput").setAttribute("aria-expanded", "true");
  }

  close() {
    this.isOpen = false;
    this.selectedIndex = -1;
    this.shadowRoot.getElementById("resultsList").classList.remove("open");
    this.shadowRoot.querySelector(".filters").classList.remove("visible");
    const input = this.shadowRoot.getElementById("searchInput");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  resetFilters() {
    this.activeFilters = {};
    this.initFilters();
    this.applyAllFilters();
  }

  updateFilterState(key, value) {
    if (value === null || value === "all" || value === "") delete this.activeFilters[key];
    else this.activeFilters[key] = value;
    this.applyAllFilters();
  }

  applyAllFilters() {
    const filteredData = applyFilters(this.searchResults, this.activeFilters, this.config.filters);
    this.updateResults(filteredData, this.shadowRoot.getElementById("searchInput").value, true);
  }

  notifyParent(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
  }

  disconnectedCallback() {
    this.eventController.abort();
    clearTimeout(this.debounceTimer);
  }
}

customElements.define("smart-search", SmartSearch);