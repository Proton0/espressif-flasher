let consoleVisible = false;
let searchVisible = false;
let eraseFlashVisible = false;
let flashCustomVisible = false;

export function error(msg) {
  consoleAddText(`<span style="color: red;">${msg}</span>`);
  console.error(msg);
}

export function consoleAddText(text) {
  const consoleDiv = document.getElementById('console-output');
  consoleDiv.innerHTML += `<p>${text}</p>`;
  consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

export function consoleClear() {
  document.getElementById('console-output').innerHTML = '';
}

export function showConsole(hide = null) {
  const consoleDiv = document.getElementById('console');
  if (hide === true) {
    consoleDiv.style.display = 'none';
    consoleVisible = false;
  } else if (hide === false) {
    consoleDiv.style.display = 'block';
    consoleVisible = true;
  } else {
    if (consoleDiv.style.display === 'none') {
      consoleDiv.style.display = 'block';
      consoleVisible = true;
    } else {
      consoleDiv.style.display = 'none';
      consoleVisible = false;
    }
  }
  checkAllVisibility();
}

export function showHideSearch(show = null) {
  const container = document.getElementById("search_container");
  if (show === true) {
    container.style.display = "block";
    searchVisible = true;
  } else if (show === false) {
    container.style.display = "none";
    searchVisible = false;
  } else {
    if (container.style.display === "none") {
      container.style.display = "block";
      searchVisible = true;
    } else {
      container.style.display = "none";
      searchVisible = false;
    }
  }
  checkAllVisibility();
}

function checkAllVisibility() {
  const ownFirmwareMenu = document.getElementById('own_firmware_menu');
  const ownFirmwareVisible = window.getComputedStyle(ownFirmwareMenu).display !== 'none';
  if (!consoleVisible && !searchVisible && !eraseFlashVisible && !flashCustomVisible && !ownFirmwareVisible) {
    const container = document.getElementById("search_container");
    container.style.display = "block";
    searchVisible = true;
  }
}

export function disableConsoleInput() {
  document.getElementById("console-input").style.display = "none";
}

export function enableConsoleInput() {
  document.getElementById("console-input").style.display = "block";
}

export function hideOwnFirmwareMenu() {
  document.getElementById('own_firmware_menu').style.display = 'none';
  enableConsoleInput();
}