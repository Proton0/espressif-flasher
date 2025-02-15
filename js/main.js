import { ESPLoader, Transport } from 'https://unpkg.com/esptool-js/bundle.js';



// Global variables for serial connection
let serialPort = null;
let serialReader = null;
let serialWriter = null;

document.addEventListener('DOMContentLoaded', () => {
  // Load firmware data
  fetch('firmware.json')
    .then((response) => response.json())
    .then((data) => {
      window.firmwareData = data;
      populateSuggestions(data);
    })
    .catch((err) => error('Error loading firmware.json:', err));

  // Filter firmware on input
  const input = document.getElementById('search_engine_input');
  input.addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase();
    const filtered = window.firmwareData.filter((fw) =>
      fw.name.toLowerCase().includes(filter)
    );
    populateSuggestions(filtered);
  });

  consoleAddText("This is the serial console. You can use it to interact with your device.");
  consoleAddText("Just note that when you flash a firmware, you wont be able to use the console until the device is reset.");

  checkIfBrowserSupportsWebSerial();

  // Attach event listener to console input to send data when Enter is pressed.
  document.getElementById("console-input").addEventListener('keydown', async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const data = event.target.value;
      event.target.value = "";
      await sendSerialData(data);
    }
  });


});

/**
 * Displays an error message in the console output.
 */
function error(msg) {
  consoleAddText(`<span style="color: red;">${msg}</span>`);
  console.error(msg);
}

/**
 * Populates the suggestion table with the given array of firmware objects.
 */
function populateSuggestions(firmwareArray) {
  const table = document.querySelector('#search_engine_suggestions table');
  // Clear existing rows (preserve header)
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
 * Appends text to the console output.
 */
function consoleAddText(text) {
  const consoleDiv = document.getElementById('console-output');
  consoleDiv.innerHTML += `<p>${text}</p>`;
  // Auto-scroll to the bottom of console
  consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

/**
 * Clears the console output.
 */
function consoleClear() {
  const consoleDiv = document.getElementById('console-output');
  consoleDiv.innerHTML = '';
}

/**
 * Prepares for firmware installation.
 */
function prepFirmwareInstall(manifest, name, version, author) {
  showHideSearch(false); // Explicitly hide search UI
  console.log('Firmware Install Requested:', { manifest, name, version, author });
  consoleClear();
  disableConsoleInput();
  disconnectConnectedSerial();
  document.getElementById('console').style.display = 'block';
  consoleAddText(`Preparing to install ${name} v${version} by ${author}`);

  loadManifest(manifest).then((manifestData) => {
    if (!manifestData) {
      showHideSearch(true); // Show search UI again if manifest fails
      error('Error loading manifest');
      enableConsoleInput();
      return;
    }
    // Get chip families from builds
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

// New helper function to prompt the user for chip family
function askUserWhatChipFamilyToUse(chipFamilies) {
  return new Promise((resolve) => {
    let message = "Select chip family:\n";
    chipFamilies.forEach((family, index) => {
      message += `${index}: ${family}\n`;
    });
    const input = window.prompt(message);
    let chosenIndex = parseInt(input, 10);
    if (isNaN(chosenIndex) || chosenIndex < 0 || chosenIndex >= chipFamilies.length) {
      chosenIndex = 0; // default to first option
    }
    consoleAddText(`Chosen chip family: ${chipFamilies[chosenIndex]}`);
    resolve(chosenIndex);
  });
}

// New helper function to download firmware parts and initiate flashing
async function downloadAndFlash(build) {
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
 * Toggles the visibility of the console.
 */
function showConsole(hide = null) {
  const consoleDiv = document.getElementById('console');
  if (hide == true) {
    consoleDiv.style.display = 'none';
    return;
  } else if (hide == false) {
    consoleDiv.style.display = 'block';
  }
  if (consoleDiv.style.display === 'none') {
    consoleDiv.style.display = 'block';
  } else {
    consoleDiv.style.display = 'none';
  }
}

/**
 * Connects to the serial port using the Web Serial API.
 */
async function connectSerial() {
  try {
    const baudrateInput = document.getElementById('console-input-baudrate');
    const baudrate = parseInt(baudrateInput.value);
    if (isNaN(baudrate)) {
      error("Invalid baudrate");
      return;
    }
    // Request a serial port from the user.
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: baudrate });
    consoleAddText(`Connected to serial port at baudrate ${baudrate}`);
    consoleAddText(`------------------------------------------------`);
    // Get a writer for sending data.
    serialWriter = serialPort.writable.getWriter();

    // Start reading incoming data.
    readLoop();
    enableConsoleInput();
  } catch (err) {
    error(`Error connecting to serial port: ${err.message}`);
  }
}

/**
 * Continuously reads data from the serial port and displays it in the console.
 */
async function readLoop() {
  const textDecoder = new TextDecoder();
  let buffer = '';
  while (serialPort && serialPort.readable) {
    try {
      serialReader = serialPort.readable.getReader();
      while (true) {
        const { value, done } = await serialReader.read();
        if (done) {
          // Reader has been canceled.
          break;
        }
        if (value) {
          buffer += textDecoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the incomplete line in the buffer
          for (const line of lines) {
            consoleAddText(line);
          }
        }
      }
    } catch (err) {
      error(`Error reading from serial port: ${err.message}`);
    } finally {
      if (serialReader) {
        serialReader.releaseLock();
      }
    }
  }
}

/**
 * Sends data to the connected serial port.
 */
async function sendSerialData(data) {
  if (serialWriter) {
    try {
      const textEncoder = new TextEncoder();
      await serialWriter.write(textEncoder.encode(data));
      consoleAddText(`Sent: ${data}`);
    } catch (err) {
      error(`Error writing to serial port: ${err.message}`);
    }
  } else {
    error("Serial port is not connected or writable.");
  }
}

/**
 * Disconnects from the connected serial port.
 */
async function disconnectConnectedSerial() {
  try {
    if (serialReader) {
      await serialReader.cancel();
      serialReader.releaseLock();
      serialReader = null;
    }
    if (serialWriter) {
      serialWriter.releaseLock();
      serialWriter = null;
    }
    if (serialPort) {
      await serialPort.close();
      serialPort = null;
    }
    consoleAddText("Disconnected from serial.");
  } catch (err) {
    error(`Error disconnecting from serial port: ${err.message}`);
  }
}

/**
 * Disables the console input field.
 */
function disableConsoleInput() {
  document.getElementById("console-input").style.display = "none";
}

/**
 * Enables the console input field.
 */
function enableConsoleInput() {
  document.getElementById("console-input").style.display = "block";
}

/**
 * Loads the manifest file for the selected firmware.
 */
function loadManifest(manifest) {
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

/**
 * Checks if the browser supports the Web Serial API.
 */
function checkIfBrowserSupportsWebSerial() {
  if ('serial' in navigator) {
    console.log('Web Serial API supported');
  } else {
    disableConsoleInput();
    showHideSearch();
    consoleClear();
    error('This browser does not support the Web Serial API. Please use a supported browser.');
    error('<a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API#browser_compatibility" target="_blank" style="color: white;">Click to check supported browsers</a>');
    showConsole(false); // Show console
    // Override showConsole to prevent further usage.
    showConsole = function() {
      error("You can't use the console without Web Serial API support.");
    }
  }
}

/**
 * Toggles the visibility of the search container.
 */
function showHideSearch(show = null) {
  const searchContainer = document.getElementById("search_container");

  if (show === true) {
    searchContainer.style.display = "block";
  } else if (show === false) {
    searchContainer.style.display = "none";
  } else {
    // Default toggle behavior (if no parameter is passed)
    searchContainer.style.display = searchContainer.style.display === "none" ? "block" : "none";
  }
}



function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function enableNavButtons() {
  const footerButtons = document.querySelectorAll('#footer button');
  footerButtons.forEach(button => {
    button.disabled = false;
  });
}

function disableNavButtons() {
  const footerButtons = document.querySelectorAll('#footer button');
  footerButtons.forEach(button => {
    button.disabled = true;
  });
}

// --------- FLASH YOUR OWN FIRMWARE FUNCTIONS ---------

/**
 * Shows the own firmware flashing menu.
 * It hides the search UI and console, disconnects any serial connection,
 * and pre-populates the table with default partitions if no rows exist.
 */
function flashOwnFirmware() {
  const ownFirmwareMenu = document.getElementById('own_firmware_menu');
  const searchContainer = document.getElementById("search_container");

  if (ownFirmwareMenu.style.display === 'block') {
    ownFirmwareMenu.style.display = 'none';
    searchContainer.style.display = 'block'; // Re-show search UI when hiding
    showConsole(true); // Hide console
    enableConsoleInput();
    return;
  }

  // Hide search and show firmware menu
  showHideSearch(false);
  consoleClear();
  showConsole(false); // Show console
  disableConsoleInput();
  disconnectConnectedSerial();
  document.getElementById('own_firmware_menu').style.display = 'block';
  consoleAddText("Select your firmware binary for each partition then click 'Start flash'.");
  populateDefaultPartitions();
}

/**
 * Hides the own firmware menu and restores the UI.
 */
function hideOwnFirmwareMenu() {
  document.getElementById('own_firmware_menu').style.display = 'none';
  enableConsoleInput();
}

/**
 * Adds a partition row to the partition table.
 * If a defaultOffset (string) is passed, it is prefilled in the Location field.
 */
function addPartitionRow(defaultOffset = '') {
  const table = document.getElementById('partition_table');
  const row = document.createElement('tr');

  // Column 1: Offset input
  const offsetCell = document.createElement('td');
  const offsetInput = document.createElement('input');
  offsetInput.type = 'text';
  offsetInput.placeholder = 'e.g. 0x1000';
  offsetInput.value = defaultOffset;
  offsetCell.appendChild(offsetInput);
  row.appendChild(offsetCell);

  // Column 2: File input
  const fileCell = document.createElement('td');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileCell.appendChild(fileInput);
  row.appendChild(fileCell);

  // Column 3: Delete button
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
 * If the partition table is empty (only header present), populate it
 * with the default partition addresses.
 */
function populateDefaultPartitions() {
  const table = document.getElementById('partition_table');
  if (table.rows.length <= 1) { // only header exists
    const defaults = ['0x1000', '0x8000', '0xE000', '0x10000'];
    defaults.forEach((addr) => addPartitionRow(addr));
  }
}

/**
 * Starts the flashing process using esptool-js.
 * It goes through each row in the partition table, validates input,
 * reads the file as an ArrayBuffer, and then flashes it at the given address.
 */
/**
 * Converts an ArrayBuffer into a binary string in chunks.
 */
function ab2str(buf) {
  const uint8 = new Uint8Array(buf);
  let result = '';
  const chunkSize = 0x8000; // 32K
  for (let i = 0; i < uint8.length; i += chunkSize) {
    result += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
  }
  return result;
}

/**
 * Reads the firmware files from the partition table.
 * Returns an array of objects: {address, data}.
 */
async function getFirmwareFileArray() {
  const table = document.getElementById('partition_table');
  const rows = table.rows;
  const fileArray = [];
  
  if (rows.length <= 1) {
    throw new Error("No firmware files selected to flash.");
  }
  
  // Row 0 assumed as header; start at index 1.
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
    
    // For optional NVS data (offset 0xE000), skip when no file is selected.
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
 * Connects to the device and flashes the firmware using ESPLoader.
 * Expects fileArray (an array of firmware file objects) as input.
 */
async function flashFirmware(fileArray) {
  disconnectConnectedSerial();
  consoleAddText("Connecting for flashing (may take a while)...");

  // Retry connection up to 3 times before giving up.
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
      consoleAddText(`Connection attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        // Wait a bit before trying again.
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  if (!device || !transport) {
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
  // Increasing delay for the chip to get ready.
  await new Promise(resolve => setTimeout(resolve, 500));
  consoleAddText(`Connected to chip: ${chip}`);
  consoleAddText("Flashing firmware...");
  await esploader.writeFlash(flashOptions);
  await esploader.after();
  consoleAddText("Flashing completed successfully.");
}

/**
 * Wrapper function to start the flashing process.
 */
async function start_flash_custom() {
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
 * Erases the flash memory.
 */

async function erase_flash() {
  disableNavButtons();
  disableConsoleInput();
  consoleClear();
  consoleAddText("Connecting for flash erase...");
  showHideSearch(false);
  hideOwnFirmwareMenu();

  try {
    showConsole(false); // force show
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
    clean: () => consoleClear(), // Clears your console output
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



// Expose functions to the window object for testing


window.erase_flash = erase_flash;
window.flashOwnFirmware = flashOwnFirmware;
window.addPartitionRow = addPartitionRow;
window.error = error
window.consoleAddText = consoleAddText;
window.hideOwnFirmwareMenu = hideOwnFirmwareMenu;
window.start_flash_custom = start_flash_custom;
window.addPartitionRow = addPartitionRow;
window.populateDefaultPartitions = populateDefaultPartitions;
window.showConsole = showConsole;
window.showHideSearch = showHideSearch;
window.connectSerial = connectSerial;
window.disconnectConnectedSerial = disconnectConnectedSerial;
window.consoleClear = consoleClear;
window.consoleAddText = consoleAddText;
window.disableConsoleInput = disableConsoleInput;
window.enableConsoleInput = enableConsoleInput;
window.checkIfBrowserSupportsWebSerial = checkIfBrowserSupportsWebSerial;
window.readFileAsArrayBuffer = readFileAsArrayBuffer;
window.loadManifest = loadManifest;
window.prepFirmwareInstall = prepFirmwareInstall;
window.populateSuggestions = populateSuggestions;
window.consoleAddText = consoleAddText;