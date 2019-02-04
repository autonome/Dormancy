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
    return config.excludedWebsites.value.some(w => w.length && url.startsWith(w));
  }

  const tabQueryOptions = {
    // keep tabs that play sound awake
    audible: false,
    // discarded tabs are already asleep, ignore them
    discarded: false,
    // keep pinned tabs awake for their special role
    pinned: false,
  }

  // Check for tabs that have hit sleeping age and put them to sleep.
  async function periodicTabCheck() {
    // Query for the active tab
    let activeWindow = await browser.windows.getCurrent();
    let activeWindowId = activeWindow.id;

    // Query for all tabs that are not the active tab
    let tabs = await browser.tabs.query({ ...tabQueryOptions, active: false });

    for (let i in tabs) {
      let tab = tabs[i];
      if (websiteIsExcluded(tab)) {
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

  function addMenu() {

    async function discardTabs(tabs) {
      tabs.forEach(tab => {
        if (!tab.active) {
          browser.tabs.discard(tab.id);
        }
      });
    }
    async function discardSelected() {
      let tabs = await browser.tabs.query({ ...tabQueryOptions, currentWindow: true, highlighted: true });
      discardTabs(tabs);
    };
    async function getCurrentWindowsTabs() {
      return await browser.tabs.query({ ...tabQueryOptions, currentWindow: true });
    }
    async function discardPositional(position) {
      let tabs = await getCurrentWindowsTabs();
      const toDiscard = []
      if (position != 'left') {
        tabs = tabs.reverse();
      }
      for (let i = 0; !tabs[i].active && i < tabs.length; i++) {
        toDiscard.push(tabs[i])
      }
      discardTabs(toDiscard);
    };
    async function discardLeft() {
      discardPositional('left');
    }
    async function discardRight() {
      discardPositional('right');
    }
    async function discardOther() {
      let tabs = await getCurrentWindowsTabs();
      discardTabs(tabs);
    }

    browser.menus.remove('dormancy-menu');
    const topMenuId = browser.menus.create({
      id: 'dormancy-menu',
      title: browser.i18n.getMessage('menuGroup'),
      icons: {
        '96': 'icon-96.png'
      },
      contexts: ['tab']
    });
    browser.menus.create({
      id: 'dormancy-menu-discard-selected',
      parentId: topMenuId,
      title: browser.i18n.getMessage('menuDiscardSelected'),
      onclick: discardSelected
    });
    browser.menus.create({
      id: 'dormancy-menu-discard-left',
      parentId: topMenuId,
      title: browser.i18n.getMessage('menuDiscardLeft'),
      onclick: discardLeft
    });
    browser.menus.create({
      id: 'dormancy-menu-discard-right',
      parentId: topMenuId,
      title: browser.i18n.getMessage('menuDiscardRight'),
      onclick: discardRight
    });
    browser.menus.create({
      id: 'dormancy-menu-discard-other',
      parentId: topMenuId,
      title: browser.i18n.getMessage('menuDiscardOther'),
      onclick: discardOther
    });
  };

  // Start everything. Or cancel what's going on and restart.
  async function init() {
    // Load (or reload) config from storage
    let oldConfig = config;
    config = await loadConfig();

    // add a context menu to tab-strip to put tabs to sleep manually
    addMenu();

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
