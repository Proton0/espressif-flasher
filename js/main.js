/* main.js
 * Entry point for the application.
 * Sets up event listeners and initializes the firmware search,
 * console, and serial connectivity.
 */

import { populateSuggestions } from './firmware.js';
import { consoleAddText } from './console.js';
import { checkIfBrowserSupportsWebSerial } from './serial.js';
import { error } from './utils.js';

// Wait for DOM to load before initializing.
document.addEventListener('DOMContentLoaded', () => {
  // Load firmware data from firmware.json.
  fetch('firmware.json')
    .then((response) => response.json())
    .then((data) => {
      window.firmwareData = data;
      populateSuggestions(data);
    })
    .catch((err) => error('Error loading firmware.json: ' + err.message));

  // Set up listener on the search input to filter firmware suggestions.
  const input = document.getElementById('search_engine_input');
  input.addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase();
    const filtered = window.firmwareData.filter((fw) =>
      fw.name.toLowerCase().includes(filter)
    );
    populateSuggestions(filtered);
  });

  // Initialize the console with welcome messages.
  consoleAddText("This is the serial console. You can use it to interact with your device.");
  consoleAddText("Just note that when you flash a firmware, you won't be able to use the console until the device is reset.");

  // Check if the browser supports the Web Serial API.
  checkIfBrowserSupportsWebSerial();

  // Attach an event listener to the console input to send data when Enter is pressed.
  document.getElementById("console-input").addEventListener('keydown', async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const data = event.target.value;
      event.target.value = "";
      if (window.sendSerialData) {
        await window.sendSerialData(data);
      }
    }
  });

  /**
   * Checks if any primary UI elements (search container, console, or firmware menu)
   * are visible. If none are open, then auto-open the search container.
   */
  function checkAndAutoOpenSearch() {
    const searchContainer = document.getElementById("search_container");
    const consoleEl = document.getElementById("console");
    const firmwareMenu = document.getElementById("own_firmware_menu");

    // Use getComputedStyle to check current display values.
    const searchOpen = window.getComputedStyle(searchContainer).display !== "none";
    const consoleOpen = window.getComputedStyle(consoleEl).display !== "none";
    const firmwareOpen = window.getComputedStyle(firmwareMenu).display !== "none";

    // If none of these UI panels are open, then auto-open the search container.
    if (!searchOpen && !consoleOpen && !firmwareOpen) {
      searchContainer.style.display = "flex";
    }
  }

  // Call the check immediately on load.
  checkAndAutoOpenSearch();

  // Expose function to window for debugging or to call after any UI change.
  window.checkAndAutoOpenSearch = checkAndAutoOpenSearch;
});

setInterval(() => {
  window.checkAndAutoOpenSearch();
}, 50);