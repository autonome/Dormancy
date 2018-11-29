'use strict';

(async () => {
  // Session storage key
  const TAB_LAST_ACTIVE_KEY = 'DORMANCY_TAB_LAST_ACTIVE';

  // Timer for interval check
  // Reference for restarting when user prefs change
  let timerId = null;

  // Configuration options
  let config = await loadConfig();

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
    let tabAgeInMS = config.timeout.value * 60 * 1000;
    if (Date.now() - lastActive >= tabAgeInMS) {
      return true;
    }

    return false;
  }

  function websiteIsExcluded({ url }) {
    return config.excludedWebsites.value.some(w => url.startsWith(w));
  }

  // Check for tabs that have hit dormanticizable age and dormanticize them.
  async function periodicTabCheck() {
    // Query for the active tab
    let activeWindow = await browser.windows.getCurrent();
    let activeWindowId = activeWindow.id;

    // Query for all tabs that are not the active tab
    let tabs = await browser.tabs.query({
        pinned: false,
        // only sleep if isn't the active tab
        active: false,
        // only sleep if not already asleep
        discarded: false,
        // do not sleep tabs that play sound
        audible: false
    });

    for (let i in tabs) {
      let tab = tabs[i];
      if (websiteIsExcluded(tab)) {
        console.log(tab.url, "excluded");
        continue;
      }
      let isOld = await tabIsOld(tab.id);
      if (
        // only sleep if tab has aged past the timeout option
        isOld
        // only sleep if the activeWindow option is false
        // or the tab is not in the active window
        && (!config.activeWindow.value || tab.windowId != activeWindowId)
      ) {
        browser.tabs.discard(tab.id);
      }
    }
  }

  // Listen for config changes and update
  browser.storage.onChanged.addListener((changes, area) => {
    if (changes[STORAGE_KEY]) {
      init();
    }
  });

  // Start everything. Or cancel what's going on and restart.
  async function init() {
    // Load (or reload) config from storage
    let oldConfig = config;
    config = await loadConfig();

    // Reset timer if timeout value changed
    if (!timerId || (oldConfig.timeout.value && (config.timeout.value != oldConfig.timeout.value))) {
      if (timerId) {
        clearInterval(timerId);
      }
      let timeoutInMS = config.timeout.value * 60 * 1000;
      timerId = setInterval(periodicTabCheck, timeoutInMS);
    }
  }

  // Extension startup
  init();
})();
