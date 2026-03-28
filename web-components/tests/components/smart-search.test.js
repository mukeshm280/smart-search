import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import { fireEvent } from "@testing-library/dom";

describe("Smart Search web component test", () => {
  beforeEach(() => {
    document.body.innerHTML = `
    <smart-search  id="bankingSearch"
        label="Search"
        placeholder="Search accounts, customers, or transactions..."
        theme="light">
    </smart-search>`;
  });

  describe("Initialization and Rendering", () => {
    test("renders input field", () => {
      const el = document.querySelector("smart-search");
      const input = el.shadowRoot.getElementById("searchInput");
      expect(input).toBeInTheDocument();
    });

    test("should have correct placeholder attribute", () => {
      const el = document.querySelector("smart-search");
      const input = el.shadowRoot.getElementById("searchInput");
      expect(input.placeholder).toBe(
        "Search accounts, customers, or transactions...",
      );
    });
  });

  describe("Search and Results Display", () => {
    test("should render search results", () => {
      const el = document.querySelector("smart-search");
      el.updateResults(
        [{ label: "Mukesh", id: 1, category: "employee", active: true }],
        "muk",
      );

      const items = el.shadowRoot.querySelectorAll(".item");
      expect(items.length).toBe(1);
    });

    test("shows no results message when no results are found", () => {
      const el = document.querySelector("smart-search");
      el.updateResults([], "xyz");
      expect(el.shadowRoot.textContent).toContain("No results found");
    });

    test("highlights matching text in the results list", () => {
      const el = document.querySelector("smart-search");
      el.updateResults(
        [{ label: "Mukesh Mali", id: 1, category: "employee", active: true }],
        "muk",
      );

      const itemLabel = el.shadowRoot.querySelector(".item-label");
      expect(itemLabel.innerHTML).toContain("highlight-term");
    });
  });

  describe("User Interactions", () => {
    test("should reset the input field when the clear button is clicked", () => {
      const el = document.querySelector("smart-search");
      const input = el.shadowRoot.getElementById("searchInput");
      const btn = el.shadowRoot.getElementById("clearBtn");

      input.value = "mukesh";
      btn.click();

      expect(input.value).toBe("");
    });

    test("shows loader when typing and hides it when results arrive", () => {
      const el = document.querySelector("smart-search");
      const input = el.shadowRoot.getElementById("searchInput");
      const loader = el.shadowRoot.getElementById("loader");

      // Simulate typing
      fireEvent.input(input, { target: { value: "m" } });
      expect(loader.classList.contains("visible")).toBe(true);

      // Simulate data arriving from parent application
      el.updateResults(
        [{ label: "Mukesh", id: 1, category: "employee", active: true }],
        "m",
      );
      expect(loader.classList.contains("visible")).toBe(false);
    });

    describe("Keyboard Navigation", () => {
      test("should select using arrow down key", () => {
        const el = document.querySelector("smart-search");
        el.updateResults(
          [
            { label: "A", id: 1 },
            { label: "B", id: 2 },
          ],
          "",
        );

        const input = el.shadowRoot.getElementById("searchInput");
        fireEvent.keyDown(input, { key: "ArrowDown" });
        expect(el.selectedIndex).toBe(0);
      });

      test("should select using Enter key", () => {
        const el = document.querySelector("smart-search");
        el.updateResults(
          [{ label: "Mukesh Mali", id: 1, key: "employee" }],
          "",
        );
        el.selectedIndex = 0;

        const input = el.shadowRoot.getElementById("searchInput");
        const spy = jest.fn();
        el.addEventListener("search-select", spy);

        fireEvent.keyDown(input, { key: "Enter" });
        expect(spy).toHaveBeenCalled();
      });
    });
  });

  describe("Filtering Logic", () => {
    test("should initialize filters from config", () => {
      const el = document.querySelector("smart-search");
      el.setAttribute(
        "config",
        JSON.stringify({
          filters: [{ key: "category", type: "select", options: ["A"] }],
        }),
      );

      el.initFilters();

      const filters = el.shadowRoot.querySelectorAll(".filter-item");
      expect(filters.length).toBeGreaterThan(0);
    });

    test("filters data based on selection", () => {
      const el = document.querySelector("smart-search");
      el.config = {
        filters: [{ key: "category", operator: "equals" }],
      };
      el.searchResults = [{ category: "A" }, { category: "B" }];
      el.activeFilters = {};
      el.updateResults(el.searchResults, "");
      expect(el.data.length).toBe(2);

      el.updateFilterState("category", "A");
      expect(el.data.length).toBe(1);
    });

    test("should reset filters clears all filters", () => {
      const el = document.querySelector("smart-search");
      el.activeFilters = { category: "A" };
      el.resetFilters();
      expect(Object.keys(el.activeFilters).length).toBe(0);
    });
  });

  describe("Dropdown Visibility State", () => {
    test("should open dropdown", () => {
      const el = document.querySelector("smart-search");
      el.open();
      expect(
        el.shadowRoot.getElementById("resultsList").classList.contains("open"),
      ).toBe(true);
    });

    test("should close dropdown", () => {
      const el = document.querySelector("smart-search");
      el.close();
      expect(
        el.shadowRoot.getElementById("resultsList").classList.contains("open"),
      ).toBe(false);
    });
  });

  describe("Lifecycle Management", () => {
    test("cleans up on disconnect", () => {
      const el = document.querySelector("smart-search");
      const spy = jest.spyOn(el.eventController, "abort");
      el.disconnectedCallback();
      expect(spy).toHaveBeenCalled();
    });
  });
});
