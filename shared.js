
// Local storage key
const STORAGE_KEY = 'dormancy.configuration';

// Default values for options
const defaults = {
  timeout: 5,
  activeWindow: false,
  excludedWebsites: ['https://www.youtube.com', 'https://appear.in']
};

let defaultConfig = {
  timeout: {
    label: browser.i18n.getMessage('optionTimeout'),
    value: defaults.timeout
  },
  activeWindow: {
    label: browser.i18n.getMessage('optionActiveWindow'),
    value: defaults.activeWindow
  },
  excludedWebsites: {
    label: browser.i18n.getMessage('optionExcludedWebsites'),
    value: defaults.excludedWebsites
  }
};

// Returns json obj - either user config or default config
async function loadConfig() {
  let data = await browser.storage.local.get(STORAGE_KEY);
  let config = { ...defaultConfig, ...data[STORAGE_KEY] };
  return config;
}

// Save data to local storage
async function saveConfig(data) {
  let saveData = {};
  saveData[STORAGE_KEY] = data;
  browser.storage.local.set(saveData).then(null, console.error);
}

