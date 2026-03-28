// Listen to the search-select event from the smart-search component
const mockDataSource = [
  {
    id: "ACC-1234",
    label: "Primary Savings",
    category: "Accounts",
    active: true,
  },
  {
    id: "ACC-5678",
    label: "Joint Checking",
    category: "Accounts",
    active: true,
  },
  {
    id: "TXN-990",
    label: "Amazon.com Payment",
    category: "Transactions",
    active: false,
  },
  {
    id: "CUST-001",
    label: "Mukesh Mali",
    category: "Customers",
    active: true,
  },
  {
    id: "TXN-882",
    label: "Salary Credit",
    category: "Transactions",
    active: true,
  },
  {
    id: "ACC-9999",
    label: "Executive Checking",
    category: "Accounts",
    active: false,
  },
  {
    id: "TXN-777",
    label: "Utilities Payment",
    category: "Transactions",
    active: true,
  },
  {
    id: "CUST-002",
    label: "Rebecca Ross",
    category: "Customers",
    active: false,
  },
  {
    id: "ACC-8888",
    label: "Investment Portfolio",
    category: "Accounts",
    active: true,
  },
  {
    id: "TXN-660",
    label: "Mortgage Transfer",
    category: "Transactions",
    active: false,
  },
];
let searchEl = document.getElementById("bankingSearch");
const configData = JSON.stringify({
  placeholder: "Search food...",
  dataSource: mockDataSource,
  filters: [
    {
      key: "category",
      label: "category",
      type: "select",
      options: ["Accounts", "Transactions", "Customers"],
      operator: "equals",
    },
    {
      key: "active",
      label: "active",
      type: "boolean",
      options: [true, false],
      operator: "equals",
    },
  ],
});
searchEl.setAttribute("config", configData);
customElements.whenDefined("smart-search").then(() => {
  const logEl = document.getElementById("selection-log");

  if (searchEl) {
    // Add style for selection log element
    logEl.style.padding = "8px 12px";

    searchEl.addEventListener("search-select", (e) => {
      const item = e.detail.item;
      console.log("Selected item value from main.js:", item);

      if (item && item.label) {
        logEl.innerText = `Selection: ${item.label} (${item.category})`;
        console.log("Banking Entity Selected:", item);
      } else {
        logEl.innerText = "";
      }
    });

    searchEl.addEventListener("search-input", (e) => {
      const query = e.detail.value.toLowerCase();
      const filtered =
        query.length > 0
          ? searchEl.config.dataSource.filter(
              (i) =>
                i.label.toLowerCase().includes(query) ||
                i.category.toLowerCase().includes(query),
            )
          : [];
      // Simulate async data fetching with a timeout
      const timer = setTimeout(() => {
        searchEl.updateResults(filtered, query);
      }, 1000);

      // Clear the timeout if a new input event occurs before the previous one completes
      searchEl.eventController.signal.addEventListener("abort", () => {
        clearTimeout(timer);
      });
    });
  }
});
