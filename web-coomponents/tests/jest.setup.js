// Explicitly import jest for ESM environment
import { jest } from "@jest/globals";

// Adds custom jest matchers from jest-dom
import "@testing-library/jest-dom";

// Mock scrollIntoView as it is not implemented in JSDOM
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Import the Web Component so it's defined in the JSDOM environment
import "../smart-search.js";
