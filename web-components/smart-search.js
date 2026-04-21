import {
  applyFilters,
  createBooleanFilter,
  createSelectFilter,
  highlight,
} from "./utility.js";

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
        --bg: #ffffff;
        --text: #333333;
        --border: #dcdfe6;
        --hover: #f5f7fa;
        --highlight: #0066cc;
        --subtext: #7f8c8d;
        display: block;
        position: relative;
        width: 100%;
        font-family: system-ui, -apple-system, sans-serif;
    }

    :host([theme="dark"]) {
        --bg: #2c3e50;
        --text: #ecf0f1;
        --border: #455a64;
        --hover: #34495e;
        --subtext: #bdc3c7;
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
        outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus { 
        border-color: var(--highlight); 
        box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.2); 
    }

    #clearBtn {
        position: absolute; right: 12px; top: 41px;
        background: #bdc3c7; color: white; border: none;
        border-radius: 50%; width: 24px; height: 24px;
        cursor: pointer; display: none; align-items: center;
        justify-content: center; font-size: 18px; line-height: 1;
        transition: background 0.2s;
    }

    #clearBtn.visible { display: flex; }
    #clearBtn:hover { background: #95a5a6; }

    .loader {
        position: absolute; right: 42px; top: 46px;
        width: 14px; height: 14px;
        border: 2px solid var(--border);
        border-top: 2px solid var(--highlight);
        border-radius: 50%; animation: spin 0.8s linear infinite;
        display: none;
    }
    .loader.visible { display: block; }

    @keyframes spin { to { transform: rotate(360deg); } }

    .filters { 
        margin-top: 12px;
        display: none; 
        gap: 16px; 
        flex-wrap: wrap; 
        align-items: center;
        background: var(--hover);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px 14px;
        box-sizing: border-box;
    }

    .filters.visible { display: flex; animation: fadeIn 0.2s ease-out; }

    .filter-item { display: flex; align-items: center; gap: 8px; }
    
    .filter-item label {
        font-size: 13px; font-weight: 600;
        color: var(--text); white-space: nowrap;
    }

    .filter-item select {
        padding: 6px 10px; font-size: 13px;
        border: 1px solid var(--border); border-radius: 4px;
        background: var(--bg); color: var(--text);
        cursor: pointer; outline: none;
    }

    .reset-filters-btn {
        margin-left: auto;
        font-size: 12px; color: var(--highlight);
        background: none; border: none;
        padding: 4px 8px; cursor: pointer;
        font-weight: 600; text-decoration: underline;
    }

    .dropdown {
        position: absolute; top: calc(100% + 5px);
        left: 0; right: 0; background: var(--bg);
        border: 1px solid var(--border); border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        max-height: 300px; overflow-y: auto;
        display: none; z-index: 100;
    }
    .dropdown.open { display: block; }

    .item {
        padding: 12px 15px; cursor: pointer;
        display: flex; flex-direction: column;
        border-bottom: 1px solid var(--border);
        transition: background 0.2s;
    }
    .item:last-child { border-bottom: none; }
    .item.active, .item:hover { background: var(--hover); }
    .item.active { border-left: 4px solid var(--highlight); }

    .item-label { font-weight: 600; font-size: 14px; color: var(--text); }
    .item-sub { font-size: 12px; color: var(--subtext); margin-top: 4px; }
    
    .highlight-term { color: var(--highlight); font-weight: bold; text-decoration: underline; }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
    }
  </style>

  <div class="search-wrapper">
      <label id="searchLabel" for="searchInput" class="search-label"></label>
      <input type="text" 
             id="searchInput" 
             autocomplete="off" 
             role="combobox" 
             aria-autocomplete="list" 
             aria-expanded="false" 
             aria-haspopup="listbox"
             aria-controls="resultsList">
      
      <div id="status" class="sr-only" aria-live="polite"></div>
      
      <button id="clearBtn" aria-label="Clear search">
        <span aria-hidden="true">×</span>
      </button>
      <div id="loader" class="loader" role="status" aria-label="Loading results"></div>
      
      <div id="filterBar" class="filters" role="region" aria-label="Search filters"></div>
      
      <div id="resultsList" 
           class="dropdown" 
           role="listbox" 
           aria-labelledby="searchLabel"></div>
  </div>
`;

class SmartSearch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.searchResults = [];
    this.filteredResults = [];
    this.selectedIndex = -1;
    this.isOpen = false;
    this.activeFilters = {};
    this.debounceTimer = null;
    this.eventController = new AbortController();
    
    this.config = { placeholder: "Search...", filters: [] };
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
      } catch (e) { console.error("SmartSearch: Config error", e); }
    }
    this.updateStaticContent();
  }

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
    
    if (!this.isOpen && items.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
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
      case "Home":
        if (this.isOpen) {
            e.preventDefault();
            this.selectedIndex = 0;
            this.updateActiveItem(items);
        }
        break;
      case "End":
        if (this.isOpen) {
            e.preventDefault();
            this.selectedIndex = items.length - 1;
            this.updateActiveItem(items);
        }
        break;
      case "Enter":
        if (this.selectedIndex >= 0) {
          e.preventDefault();
          this.selectItem(this.filteredResults[this.selectedIndex]);
        }
        break;
      case "Escape":
        this.close();
        this.shadowRoot.getElementById("searchInput").focus();
        break;
      case "Tab":
        this.close();
        break;
    }
  }

  handleClear() {
    const input = this.shadowRoot.getElementById("searchInput");
    input.value = "";
    this.selectedIndex = -1;
    this.shadowRoot.getElementById("clearBtn").classList.remove("visible");
    this.announceStatus("Search cleared");
    this.close();
    input.focus();
    this.notifyParent("search-input", { value: "" });
  }

  initFilters() {
    const container = this.shadowRoot.getElementById("filterBar");
    if (!this.config.filters?.length) {
        container.classList.remove("visible");
        return;
    }

    container.innerHTML = `<span style="font-size: 13px; color: var(--text); font-weight:bold;" aria-hidden="true">Filters:</span>`;

    this.config.filters.forEach((filter) => {
      const wrapper = document.createElement("div");
      wrapper.className = "filter-item";
      
      const label = document.createElement("label");
      const id = `f-${filter.key}`;
      label.textContent = filter.label || filter.key;
      label.setAttribute("for", id);
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
    resetBtn.textContent = "Reset All";
    resetBtn.className = "reset-filters-btn";
    resetBtn.setAttribute("aria-label", "Reset all filters");
    resetBtn.onclick = () => this.resetFilters();
    container.appendChild(resetBtn);
  }

  announceStatus(msg) {
    const status = this.shadowRoot.getElementById("status");
    status.textContent = msg;
  }

  updateResults(results, query, internalFilter = false) {
    const list = this.shadowRoot.getElementById("resultsList");
    this.shadowRoot.getElementById("loader").classList.remove("visible");

    if (!internalFilter) this.searchResults = results;
    this.filteredResults = results;
    this.selectedIndex = -1;

    if (query) {
        const countMsg = results.length > 0 
            ? `${results.length} results found. Use up and down arrows to navigate.` 
            : "No results found.";
        this.announceStatus(countMsg);
    }

    if (!results.length) {
      if (!query) { this.close(); return; }
      list.innerHTML = `<div class="item" role="option" aria-disabled="true" style="text-align:center; color:var(--subtext);">No results found</div>`;
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
      el.onclick = () => {
        const item = this.filteredResults[el.dataset.index];
        if (item) this.selectItem(item);
      };
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
    this.announceStatus(`Selected: ${item.label}`);
    this.notifyParent("search-select", { item });
    this.close();
    input.focus();
  }

  open() {
    this.isOpen = true;
    this.shadowRoot.getElementById("resultsList").classList.add("open");
    if (this.config.filters?.length) this.shadowRoot.getElementById("filterBar").classList.add("visible");
    this.shadowRoot.getElementById("searchInput").setAttribute("aria-expanded", "true");
  }

  close() {
    this.isOpen = false;
    this.selectedIndex = -1;
    this.shadowRoot.getElementById("resultsList").classList.remove("open");
    this.shadowRoot.getElementById("filterBar").classList.remove("visible");
    const input = this.shadowRoot.getElementById("searchInput");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  resetFilters() {
    this.activeFilters = {};
    this.initFilters();
    this.applyAllFilters();
    this.announceStatus("Filters reset");
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
    this.dispatchEvent(new CustomEvent(eventName, { 
        detail, 
        bubbles: true, 
        composed: true 
    }));
  }

  disconnectedCallback() {
    this.eventController.abort();
    clearTimeout(this.debounceTimer);
  }
}

customElements.define("smart-search", SmartSearch);