'use strict';

(async () => {
  // Age at which tabs should be dormanticized (default 5 mins)
  const TAB_AGE_MS = 5 * 60 * 1000;

  // Session storage key
  const TAB_LAST_ACTIVE_KEY = 'DORMANCY_TAB_LAST_ACTIVE';

  // Local storage key
  const STORAGE_KEY = 'dormancy.configuration';

  // Timer for interval check
  // Reference for restarting when user prefs change
  let timerId = null;

  // Get default config from manifest
  let manifest = await browser.runtime.getManifest();
  let cfg = manifest.options;

  // Store the current timestamp on a tab
  async function setTabLastActive(tabId) {
    browser.sessions.setTabValue(tabId, TAB_LAST_ACTIVE_KEY, Date.now());
  }

  // When a tab is selected, store current timestamp
  browser.tabs.onActivated.addListener(info => {
    setTabLastActive(info.tabId);
  });

  // bool whether or not tab is old enough to make dormant
  async function tabIsOld(tabId) {
    // Get tab last active date
    const lastActive = await browser.sessions.getTabValue(tabId, TAB_LAST_ACTIVE_KEY);

    // Not yet stored
    // (will happen next time tab is made active)
    if (!lastActive) {
      return false;
    }

    // If last active time is past the dormancy trigger
    let tabAgeInMS = cfg.timeout * 60 * 1000;
    if (Date.now() - lastActive >= tabAgeInMS) {
      return true;
    }

    return false;
  }

  // Check for tabs that have hit dormanticizable age and dormanticize them.
  async function periodicTabCheck() {
    // Query for the active tab
    let activeTabs = await browser.tabs.query({ active: true, currentWindow: true })
    let activeTabId = activeTabs[0].id;

    // Query for all tabs that are not the active tab
    let tabs = await browser.tabs.query({pinned: false});

    for (let i in tabs) {
      let tab = tabs[i];
      let isOld = await tabIsOld(tab.id);
      if (tab.id != activeTabId && !tab.discarded && isOld) {
        browser.tabs.discard(tab.id);
      }
    }
  }

  // Listen for config changes and update
  browser.storage.onChanged.addListener((changes, area) => {
    if (changes[STORAGE_KEY]) {
      // TODO: fix global
      cfg = changes[STORAGE_KEY].newValue;
      init();
    }
  });

  // Returns json obj - either user config or defaults
  async function loadConfig() {
    let data = await browser.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY]) {
      cfg = data[STORAGE_KEY];
    }
    return cfg;
  }

  // Start everything. Or cancel what's going on and restart.
  async function init() {
    let cfg = await loadConfig();
    if (timerId) {
      clearInterval(timerId);
    }
    let timeoutInMS = cfg.timeout * 60 * 1000;
    timerId = setInterval(periodicTabCheck, timeoutInMS);
  }

  // Extension startup
  init();
})();
