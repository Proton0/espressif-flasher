/* utils.js
 * Utility functions used throughout the application.
 * Contains helper functions for error logging, data conversion,
 * file reading, and enabling/disabling navigation buttons.
 */

/**
 * Logs an error message to the console and displays it in the UI.
 * @param {string} msg - The error message to display.
 */
export function error(msg) {
    // If the console UI function is available, use it to show the error.
    if (window.consoleAddText) {
      window.consoleAddText(`<span style="color: red;">${msg}</span>`);
    }
    console.error(msg);
  }
  
  /**
   * Converts an ArrayBuffer to a binary string.
   * This is used for processing firmware binary data.
   * @param {ArrayBuffer} buf - The ArrayBuffer to convert.
   * @returns {string} The binary string representation.
   */
  export function ab2str(buf) {
    const uint8 = new Uint8Array(buf);
    let result = '';
    const chunkSize = 0x8000; // 32K
    for (let i = 0; i < uint8.length; i += chunkSize) {
      result += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
    }
    return result;
  }
  
  /**
   * Reads a File object as an ArrayBuffer.
   * @param {File} file - The file to read.
   * @returns {Promise<ArrayBuffer>} A promise that resolves with the ArrayBuffer.
   */
  export function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Enables navigation buttons in the footer.
   */
  export function enableNavButtons() {
    const footerButtons = document.querySelectorAll('#footer button');
    footerButtons.forEach(button => {
      button.disabled = false;
    });
  }
  
  /**
   * Disables navigation buttons in the footer.
   */
  export function disableNavButtons() {
    const footerButtons = document.querySelectorAll('#footer button');
    footerButtons.forEach(button => {
      button.disabled = true;
    });
  }
  
  // Expose functions to window for debugging
  window.error = error;
  window.ab2str = ab2str;
  window.readFileAsArrayBuffer = readFileAsArrayBuffer;
  window.enableNavButtons = enableNavButtons;
  window.disableNavButtons = disableNavButtons;
  