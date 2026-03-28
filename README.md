# smart-search web component

Framework agnostic smart search web component
A reusable, customizable search component with advanced filtering and keyboard navigation.

## Features

- **Framework Agnostic**: Works with any JavaScript framework (React, Vue, Angular) or vanilla HTML.
- **Advanced Filtering**: Supports `select` and `boolean` filters with extensible operators (`equals`, `includes`, `between`, `in`).
- **Accessible**: Full keyboard navigation support (Arrow keys, Enter, Escape) and ARIA attributes.
- **Themeable**: Built-in support for Light and Dark modes.
- **Shadow DOM**: Complete style isolation to prevent CSS conflicts with the host application.

## Installation

Simply include the `smart-search.js` file in your project:

```html
<script type="module" src="path/to/smart-search.js"></script>
```

## Usage Example

```html
<!-- 1. Add the component to your HTML -->
<smart-search
  id="bankingSearch"
  label="Account Search"
  placeholder="Search accounts or customers..."
  theme="light"
>
</smart-search>

<!-- Load the component as a module -->
<script type="module" src="path/to/smart-search.js"></script>

<script>
  const searchComp = document.getElementById("bankingSearch");

  // 2. Configure filters
  searchComp.setAttribute(
    "config",
    JSON.stringify({
      filters: [
        {
          key: "category",
          label: "Category",
          type: "select",
          options: ["Employee", "Customer", "Transaction"],
          operator: "equals",
        },
        {
          key: "active",
          label: "Status",
          type: "boolean",
          operator: "equals",
        },
      ],
    }),
  );

  // 3. Listen for search input (with built-in 300ms debounce)
  searchComp.addEventListener("search-input", (e) => {
    const query = e.detail.value;

    // Example data - usually fetched from an API
    const data = [
      { label: "Mukesh Mali", id: "101", category: "Employee", active: true },
      { label: "John Doe", id: "102", category: "Customer", active: false },
    ];

    // Push results back to the component
    searchComp.updateResults(data, query);
  });

  // 4. Handle item selection
  searchComp.addEventListener("search-select", (e) => {
    console.log("User selected:", e.detail.item);
  });
</script>
```

## API Reference

### Attributes

| Attribute     | Description                                   | Default     |
| ------------- | --------------------------------------------- | ----------- |
| `label`       | The text displayed as the search field label. | `Search`    |
| `placeholder` | The placeholder text inside the input field.  | `Search...` |
| `theme`       | Sets the UI theme: `light` or `dark`.         | `light`     |
| `config`      | A JSON string defining the filter structure.  | `{}`        |

### Configuration Filters

The `filters` array in the `config` object supports:

- `key`: The property name in your data objects.
- `type`: `select` or `boolean`.
- `operator`: `equals`, `includes`, `between`, or `in`.

### Events

| Event Name      | Detail              | Description                                           |
| --------------- | ------------------- | ----------------------------------------------------- |
| `search-input`  | `{ value: string }` | Fired when user types (debounced).                    |
| `search-select` | `{ item: object }`  | Fired when a result is clicked or selected via Enter. |

### Public Methods

- `updateResults(results: Array, query: string)`: Refresh the dropdown list.
- `resetFilters()`: Resets all UI filter controls and internal state.
- `open()` / `close()`: Manually control dropdown visibility.

## Development & Testing

Tests are located in the `/tests` directory and use Jest with JSDOM.

```bash
cd tests
npm install
npm test
```
