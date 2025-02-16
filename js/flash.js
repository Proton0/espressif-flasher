/* flash.js
 * Contains functions related to flashing firmware onto a device,
 * including both pre-defined firmware flashing and custom firmware flashing.
 */

import { error, ab2str, readFileAsArrayBuffer, disableNavButtons, enableNavButtons } from './utils.js';
import { consoleAddText, consoleClear, disableConsoleInput, enableConsoleInput, showConsole, showHideSearch } from './console.js';
import { ESPLoader, Transport } from 'https://unpkg.com/esptool-js/bundle.js';

/**
 * Downloads firmware parts and initiates the flashing process.
 * @param {Object} build - The firmware build object containing parts information.
 */
export async function downloadAndFlash(build) {
  consoleAddText("Downloading firmware");
  const fileArray = [];
  for (const part of build.parts) {
    try {
      const response = await fetch(part.path);
      if (!response.ok) {
        enableNavButtons();
        enableConsoleInput();
        error("Failed to download " + part.path);
        throw new Error("Failed to download " + part.path);
      }
      const buffer = await response.arrayBuffer();
      const data = ab2str(buffer);
      fileArray.push({ address: part.offset, data: data });
      consoleAddText(`Downloaded ${part.path}`);
    } catch (err) {
      error(err.message);
      return;
    }
  }
  consoleAddText("All parts downloaded. Proceeding to flash.");
  await flashFirmware(fileArray);
}

/**
 * Flashes the firmware using esptool-js.
 * @param {Array} fileArray - Array of firmware file objects {address, data}.
 */
export async function flashFirmware(fileArray) {
  // Disconnect any existing serial connection.
  if (window.disconnectConnectedSerial) {
    window.disconnectConnectedSerial();
  }
  consoleAddText("Connecting for flashing (may take a while)...");

  let device = null;
  let transport = null;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      device = await navigator.serial.requestPort();
      transport = new Transport(device, true);
      consoleAddText(`Connection established on attempt ${attempt}.`);
      break;
    } catch (err) {
      error(`Connection attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        // Wait a bit before trying again.
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  if (!device || !transport) {
    enableConsoleInput();
    error("Unable to connect to device after multiple attempts.");
    throw new Error("Unable to connect to device after multiple attempts.");
  }

  const flashOptions = {
    transport: transport,
    baudrate: 115200,
    terminal: {
      clean: () => consoleClear(),
      writeLine: (data) => consoleAddText(data),
      write: (data) => consoleAddText(data)
    },
    debugLogging: false,
    fileArray: fileArray,
    flashSize: "keep",
    eraseAll: false,
    compress: true,
    reportProgress: (fileIndex, written, total) => {
      consoleAddText(`File ${fileIndex}: ${(written / total * 100).toFixed(2)}% flashed.`);
    }
  };

  const esploader = new ESPLoader(flashOptions);
  const chip = await esploader.main();
  // Delay for chip readiness.
  await new Promise(resolve => setTimeout(resolve, 500));
  consoleAddText(`Connected to chip: ${chip}`);
  consoleAddText("Flashing firmware...");
  await esploader.writeFlash(flashOptions);
  await esploader.after();
  consoleAddText("Flashing completed successfully.");
}

/**
 * Adds a partition row to the custom firmware partition table.
 * @param {string} defaultOffset - Optional default offset value.
 */
export function addPartitionRow(defaultOffset = '') {
  const table = document.getElementById('partition_table');
  const row = document.createElement('tr');

  // Column 1: Offset input.
  const offsetCell = document.createElement('td');
  const offsetInput = document.createElement('input');
  offsetInput.type = 'text';
  offsetInput.placeholder = 'e.g. 0x1000';
  offsetInput.value = defaultOffset;
  offsetCell.appendChild(offsetInput);
  row.appendChild(offsetCell);

  // Column 2: File input.
  const fileCell = document.createElement('td');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileCell.appendChild(fileInput);
  row.appendChild(fileCell);

  // Column 3: Delete button.
  const deleteCell = document.createElement('td');
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.onclick = () => {
    table.removeChild(row);
  };
  deleteCell.appendChild(deleteButton);
  row.appendChild(deleteCell);

  table.appendChild(row);
}

/**
 * Populates the partition table with default partition addresses if empty.
 */
export function populateDefaultPartitions() {
  const table = document.getElementById('partition_table');
  if (table.rows.length <= 1) { // Only header exists.
    const defaults = ['0x1000', '0x8000', '0xE000', '0x10000'];
    defaults.forEach((addr) => addPartitionRow(addr));
  }
}

/**
 * Reads firmware files from the partition table and returns them as an array.
 * @returns {Promise<Array>} Array of firmware file objects {address, data}.
 */
export async function getFirmwareFileArray() {
  const table = document.getElementById('partition_table');
  const rows = table.rows;
  const fileArray = [];
  
  if (rows.length <= 1) {
    throw new Error("No firmware files selected to flash.");
  }
  
  // Row 0 is assumed to be the header.
  for (let i = 1; i < rows.length; i++) {
    const offsetInput = rows[i].cells[0].querySelector("input");
    const fileInput = rows[i].cells[1].querySelector("input[type='file']");
    
    if (!offsetInput || !offsetInput.value.trim()) {
      throw new Error(`Invalid offset in row ${i}`);
    }
    
    const offset = parseInt(offsetInput.value, 16);
    if (isNaN(offset)) {
      throw new Error(`Invalid hex value for offset in row ${i}`);
    }
    
    // For optional NVS data (offset 0xE000), skip if no file is selected.
    if ((!fileInput || !fileInput.files || fileInput.files.length === 0) && offset === 0xE000) {
      continue;
    }
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      throw new Error(`No file selected in row ${i}`);
    }
    
    try {
      const fileDataBuffer = await readFileAsArrayBuffer(fileInput.files[0]);
      const fileData = ab2str(fileDataBuffer);
      fileArray.push({ data: fileData, address: offset });
    } catch (err) {
      throw new Error(`Error reading file in row ${i}: ${err.message}`);
    }
  }
  
  if (fileArray.length === 0) {
    throw new Error("No valid firmware files to flash.");
  }
  
  return fileArray;
}

/**
 * Starts the custom firmware flashing process.
 * Reads firmware files and initiates the flashing.
 */
export async function start_flash_custom() {
  try {
    disableConsoleInput();
    disableNavButtons();
    showHideSearch();
    consoleClear();
  
    // Get firmware files from partition table.
    const fileArray = await getFirmwareFileArray();
    // Perform flashing procedure.
    await flashFirmware(fileArray);
    enableNavButtons();
  } catch (err) {
    error(err.message);
    enableNavButtons();
  }
}

/**
 * Displays the custom firmware flashing menu.
 * Hides search UI and console, disconnects serial, and prepares the partition table.
 */
export function flashOwnFirmware() {
  const ownFirmwareMenu = document.getElementById('own_firmware_menu');
  const searchContainer = document.getElementById("search_container");

  if (ownFirmwareMenu.style.display === 'block') {
    ownFirmwareMenu.style.display = 'none';
    searchContainer.style.display = 'block'; // Re-show search UI when hiding.
    showConsole(true); // Hide console.
    enableConsoleInput();
    return;
  }

  // Hide search and show firmware menu.
  showHideSearch(false);
  consoleClear();
  showConsole(false); // Show console.
  disableConsoleInput();
  if (window.disconnectConnectedSerial) {
    window.disconnectConnectedSerial();
  }
  document.getElementById('own_firmware_menu').style.display = 'block';
  consoleAddText("Select your firmware binary for each partition then click 'Start flash'.");
  populateDefaultPartitions();
}

/**
 * Hides the custom firmware flashing menu and restores the UI.
 */
export function hideOwnFirmwareMenu() {
  document.getElementById('own_firmware_menu').style.display = 'none';
  enableConsoleInput();
}

/**
 * Erases the device flash memory.
 */
export async function erase_flash() {
  disableNavButtons();
  disableConsoleInput();
  consoleClear();
  consoleAddText("Connecting for flash erase...");
  showHideSearch(false);
  hideOwnFirmwareMenu();

  try {
    showConsole(false); // Force show console.
    const device = await navigator.serial.requestPort();
    if (!device) {
      error("No serial device selected.");
      enableNavButtons();
      showHideSearch(true);
      return;
    }

    const transport = new Transport(device, true);
    const flashOptions = {
      transport: transport,
      baudrate: 115200,
      terminal: { 
        clean: () => consoleClear(),
        writeLine: (data) => consoleAddText(data),
        write: (data) => consoleAddText(data)
      },
      debugLogging: true
    };

    const esploader = new ESPLoader(flashOptions);
    const chip = await esploader.main();
    consoleAddText(`Connected to chip: ${chip}`);

    consoleAddText("Erasing flash...");
    await esploader.eraseFlash();
    consoleAddText("Flash erase completed.");
    enableNavButtons();
  } catch (err) {
    enableNavButtons();
    showConsole(false);
    showHideSearch(true);
    error(`Error during flash erase: ${err.message}`);
  }
}

// Expose functions to window for debugging
window.downloadAndFlash = downloadAndFlash;
window.flashFirmware = flashFirmware;
window.addPartitionRow = addPartitionRow;
window.populateDefaultPartitions = populateDefaultPartitions;
window.getFirmwareFileArray = getFirmwareFileArray;
window.start_flash_custom = start_flash_custom;
window.flashOwnFirmware = flashOwnFirmware;
window.hideOwnFirmwareMenu = hideOwnFirmwareMenu;
window.erase_flash = erase_flash;
