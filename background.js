'use strict';

// console toggle
console.log = function () {};

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
    return config.excludedWebsites.value.some(w => w.length && url.startsWith(w));
  }

  // Check for tabs that have hit dormanticizable age and dormanticize them.
  async function periodicTabCheck() {
    console.log('periodicTabCheck()');

    // Query for the active window
    let activeWindow = await browser.windows.getCurrent();
    let activeWindowId = activeWindow.id;

    // Query for all tabs that are not the active tab
    let tabs = await browser.tabs.query({
        pinned: false,
        // only sleep if isn't the active tab
        active: false,
        // only sleep if not already asleep
        discarded: false,
        // do not sleep tabs that are playing sound
        audible: false
    });

    console.log('periodicTabCheck(): tabs', tabs.length);

    for (let i in tabs) {

      let tab = tabs[i];

      if (websiteIsExcluded(tab)) {
        console.log('periodicTabCheck(): website is excluded', tab);
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
        console.log('discarding tab', tab);
        browser.tabs.discard(tab.id);
      }
      else {
        // not discarding tab
        console.log('not discarding tab', tab);
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
    console.log('init');
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
    console.log('init done');
  }

  // Extension startup
  init();
})();
