// Age at which tabs should be dormanticized (default 5 mins)
const TAB_AGE_MS = 5 * 60 * 1000;

// Storage key
const TAB_LAST_ACTIVE_KEY = 'DORMANCY_TAB_LAST_ACTIVE';

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
  if (Date.now() - lastActive >= TAB_AGE_MS) {
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
  let tabs = await browser.tabs.query({});

  for (let i in tabs) {
    let tab = tabs[i];
    let isOld = await tabIsOld(tab.id);
    if (tab.id != activeTabId && !tab.discarded && isOld) {
      browser.tabs.discard(tab.id);
    }
  }
}

setInterval(periodicTabCheck, TAB_AGE_MS);
