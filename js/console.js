/* console.js
 * Handles console UI operations such as appending text,
 * clearing the console, and toggling console input.
 */

/**
 * Appends text to the console output area.
 * @param {string} text - The text to append.
 */
export function consoleAddText(text) {
    const consoleDiv = document.getElementById('console-output');
    consoleDiv.innerHTML += `<p>${text}</p>`;
    // Auto-scroll to the bottom of the console.
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
  }
  
  /**
   * Clears all text from the console output.
   */
  export function consoleClear() {
    const consoleDiv = document.getElementById('console-output');
    consoleDiv.innerHTML = '';
  }
  
  /**
   * Disables the console input field.
   */
  export function disableConsoleInput() {
    document.getElementById("console-input").style.display = "none";
  }
  
  /**
   * Enables the console input field.
   */
  export function enableConsoleInput() {
    document.getElementById("console-input").style.display = "block";
  }
  
  /**
   * Toggles the visibility of the console.
   * If parameter `hide` is provided, it forces that state.
   * @param {boolean|null} hide - Optional parameter to force hide/show.
   */
  export function showConsole(hide = null) {
    const consoleDiv = document.getElementById('console');
    if (hide === true) {
      consoleDiv.style.display = 'none';
      return;
    } else if (hide === false) {
      consoleDiv.style.display = 'block';
      return;
    }
    // Toggle default behavior.
    consoleDiv.style.display = (consoleDiv.style.display === 'none') ? 'block' : 'none';
  }
  
  /**
   * Toggles the visibility of the search container.
   * If a boolean value is provided, it explicitly shows/hides.
   * @param {boolean|null} show - Optional parameter to force show/hide.
   */
  export function showHideSearch(show = null) {
    const searchContainer = document.getElementById("search_container");
    if (show === true) {
      searchContainer.style.display = "block";
    } else if (show === false) {
      searchContainer.style.display = "none";
    } else {
      // Toggle default behavior.
      searchContainer.style.display = (searchContainer.style.display === "none") ? "block" : "none";
    }
  }
  
  // Expose functions to window for debugging
  window.consoleAddText = consoleAddText;
  window.consoleClear = consoleClear;
  window.disableConsoleInput = disableConsoleInput;
  window.enableConsoleInput = enableConsoleInput;
  window.showConsole = showConsole;
  window.showHideSearch = showHideSearch;
  