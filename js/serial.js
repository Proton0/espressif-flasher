/* serial.js
 * Contains functions to manage the serial connection using the Web Serial API.
 * Functions include connecting to a serial port, reading incoming data,
 * sending data, and disconnecting.
 */

import { consoleAddText, disableConsoleInput, enableConsoleInput, showHideSearch, consoleClear } from './console.js';
import { error } from './utils.js';

let serialPort = null;
let serialReader = null;
let serialWriter = null;

/**
 * Connects to a serial port with a specified baud rate.
 */
export async function connectSerial() {
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
export async function readLoop() {
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
          buffer = lines.pop() || ''; // keep the incomplete line in the buffer.
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
 * @param {string} data - The data to send.
 */
export async function sendSerialData(data) {
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
export async function disconnectConnectedSerial() {
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
 * Checks if the browser supports the Web Serial API.
 * Disables console input and shows error if not supported.
 */
export function checkIfBrowserSupportsWebSerial() {
  if ('serial' in navigator) {
    console.log('Web Serial API supported');
  } else {
    disableConsoleInput();
    showHideSearch(true);
    consoleClear();
    error('This browser does not support the Web Serial API. Please use a supported browser.');
    error('<a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API#browser_compatibility" target="_blank" style="color: white;">Click to check supported browsers</a>');
    // Force the console to show errors.
    if (window.showConsole) {
      window.showConsole(false);
    }
    // Override showConsole to prevent further usage.
    window.showConsole = function() {
      error("You can't use the console without Web Serial API support.");
    }
  }
}

// Expose functions to window for debugging
window.connectSerial = connectSerial;
window.readLoop = readLoop;
window.sendSerialData = sendSerialData;
window.disconnectConnectedSerial = disconnectConnectedSerial;
window.checkIfBrowserSupportsWebSerial = checkIfBrowserSupportsWebSerial;
