
// Local storage key
const STORAGE_KEY = 'dormancy.configuration';

// Default values for options
const defaults = {
  timeout: 5,
  activeWindow: false
};

// Returns json obj - either user config or defaults
async function loadConfig() {
  let data = await browser.storage.local.get(STORAGE_KEY);
  let config = null;
  if (data[STORAGE_KEY]) {
    console.log('from storage');
    config = data[STORAGE_KEY];
  }
  else {
    config = {
      timeout: {
        label: browser.i18n.getMessage('optionTimeout'),
        value: defaults.timeout
      },
      activeWindow: {
        label: browser.i18n.getMessage('optionActiveWindow'),
        value: defaults.activeWindow
      }
    };
  }
  return config;
}

// Save data to local storage
async function saveConfig(data) {
  let saveData = {};
  saveData[STORAGE_KEY] = data;
  browser.storage.local.set(saveData).then(null, console.error);
}
  
