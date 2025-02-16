/* firmware.js
 * Functions related to handling firmware data,
 * populating firmware suggestions, and preparing for firmware installation.
 */

import { error } from './utils.js';
import { consoleAddText, consoleClear, disableConsoleInput, enableConsoleInput, showHideSearch } from './console.js';
import { downloadAndFlash } from './flash.js';

/**
 * Populates the firmware suggestion table with firmware objects.
 * @param {Array} firmwareArray - Array of firmware objects.
 */
export function populateSuggestions(firmwareArray) {
  const table = document.querySelector('#search_engine_suggestions table');
  // Clear existing rows and add header.
  table.innerHTML = `
    <tr>
      <th>Firmware Name</th>
      <th>Version</th>
      <th>Author</th>
      <th>Device</th>
    </tr>
  `;
  firmwareArray.forEach((fw) => {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      prepFirmwareInstall(fw.manifest, fw.name, fw.version, fw.author);
    });
    row.innerHTML = `
      <td>${fw.name}</td>
      <td>${fw.version}</td>
      <td>${fw.author}</td>
      <td>${fw.device || ''}</td>
    `;
    table.appendChild(row);
  });
}

/**
 * Prepares the system for firmware installation.
 * Hides the search UI, clears the console, disables input,
 * and initiates manifest loading.
 * @param {string} manifest - URL/path to the firmware manifest.
 * @param {string} name - Firmware name.
 * @param {string} version - Firmware version.
 * @param {string} author - Firmware author.
 */
export function prepFirmwareInstall(manifest, name, version, author) {
  // Hide search UI.
  showHideSearch(false);
  console.log('Firmware Install Requested:', { manifest, name, version, author });
  consoleClear();
  disableConsoleInput();
  // Disconnect any existing serial connection if available.
  if (window.disconnectConnectedSerial) {
    window.disconnectConnectedSerial();
  }
  document.getElementById('console').style.display = 'block';
  consoleAddText(`Preparing to install ${name} v${version} by ${author}`);

  loadManifest(manifest).then((manifestData) => {
    if (!manifestData) {
      showHideSearch(true); // Show search UI again if manifest fails.
      error('Error loading manifest');
      enableConsoleInput();
      return;
    }
    // Get chip families from builds.
    const chipFamilies = manifestData.builds.map(build => build.chipFamily);
    if (chipFamilies.length > 1) {
      askUserWhatChipFamilyToUse(chipFamilies).then(chosenIndex => {
        const chosenBuild = manifestData.builds[chosenIndex];
        downloadAndFlash(chosenBuild);
      });
    } else {
      downloadAndFlash(manifestData.builds[0]);
    }
  });
}

/**
 * Prompts the user to select a chip family if multiple are available.
 * @param {Array} chipFamilies - Array of chip family names.
 * @returns {Promise<number>} Promise resolving to the chosen index.
 */
export function askUserWhatChipFamilyToUse(chipFamilies) {
  return new Promise((resolve) => {
    let message = "Select chip family:\n";
    chipFamilies.forEach((family, index) => {
      message += `${index}: ${family}\n`;
    });
    const input = window.prompt(message);
    let chosenIndex = parseInt(input, 10);
    if (isNaN(chosenIndex) || chosenIndex < 0 || chosenIndex >= chipFamilies.length) {
      error('Invalid chip family index');
      enableConsoleInput();
      return;
    }
    consoleAddText(`Chosen chip family: ${chipFamilies[chosenIndex]}`);
    resolve(chosenIndex);
  });
}

/**
 * Loads a firmware manifest file and returns its JSON content.
 * @param {string} manifest - URL/path to the manifest file.
 * @returns {Promise<Object|null>} The manifest data or null on error.
 */
export function loadManifest(manifest) {
  return fetch(manifest)
    .then((response) => response.json())
    .then((data) => {
      console.log('Loaded manifest:', data);
      return data;
    })
    .catch((err) => {
      error('Error loading manifest: ' + err.message);
      enableConsoleInput();
      return null;
    });
}

// Expose functions to window for debugging
window.populateSuggestions = populateSuggestions;
window.prepFirmwareInstall = prepFirmwareInstall;
window.askUserWhatChipFamilyToUse = askUserWhatChipFamilyToUse;
window.loadManifest = loadManifest;
