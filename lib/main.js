const {Cc, Ci, Cu, Cm} = require('chrome');
const Ss = Cc["@mozilla.org/browser/sessionstore;1"].
           getService(Ci.nsISessionStore);
const Timer = require('timer');
const Wu = require("window-utils");
const PrefWatcher = require("prefwatcher");
const Preferences = require("preferences-service");

const PREF_PREFIX = "extensions.dormancy.";
const PREF_ROD = "browser.sessionstore.restore_on_demand";
const TAB_STATE_NEEDS_RESTORE = 1;

// Age at which tabs should be dormanticized (default 5 mins)
let TabDormancyAgeMs = 5 * 60 * 1000;
PrefWatcher.watch(PREF_PREFIX + "TabDormancyAgeMs",
                  function(val) TabDormancyAgeMs = val || TabDormancyAgeMs);

// How often to cull tabs (default 5 minutes)
let TabCheckIntervalMs = 5 * 60 * 1000;
PrefWatcher.watch(PREF_PREFIX + "TabCheckIntervalMs",
                  function(val) TabCheckIntervalMs = val || TabCheckIntervalMs);


// Whether tabs are restored on-demand
let TabRestoreOnDemand = Preferences.get(PREF_ROD, false);
PrefWatcher.watch(PREF_ROD, function(val) TabRestoreOnDemand = !!val);

function shouldDormanticizeTab(tab) {
  let window = tab.ownerDocument.defaultView;
  let tabbrowser = window.gBrowser;
  let browser = tab.linkedBrowser;

  // don't dormanticize app tabs or the currently selected
  if (tab.pinned || tab == tabbrowser.selectedTab)
    return false;

  // don't dormanticize if the tab is waiting to be restored
  if (browser.__SS_restoreState &&
      browser.__SS_restoreState == TAB_STATE_NEEDS_RESTORE)
    return false;

  // don't dormanticize if the tab would be restored immediately
  if (!tab.hidden && !TabRestoreOnDemand)
    return false;

  let lastActive = Ss.getTabValue(tab, "lastActive");

  if (!lastActive) {
    // For lack of a better option
    Ss.setTabValue(tab, "lastActive", Date.now());
    return true;
  }

  // dormanticize depending on how long the tab has been inactive
  return (Date.now() - lastActive >= TabDormancyAgeMs)
}

// save a tab's state
function dormanticizeTab(tab) {
  let browser = tab.linkedBrowser;
  let tabState = Ss.getTabState(tab);
  let tabbrowser = tab.ownerDocument.defaultView.gBrowser;

  // replace the current tab state with a blank one
  let cleanTab = tabbrowser.addTab("about:blank", {skipAnimation: true});
  tabbrowser.swapBrowsersAndCloseOther(tab, cleanTab);

  // prepare the tab to be restored again
  Ss.setTabState(tab, tabState);
}

// On tab select, if tab is dormant, restore it.
function onTabSelect(event) {
  let tab = event.target;

  // update last-active value
  Ss.setTabValue(tab, "lastActive", Date.now());
}

// Check for tabs that have hit dormanticizable age
// and dormanticize them.
function periodicTabCheck(window) {
  let tabs;
  let numDormanticized = 0;
  let gBrowser = window.gBrowser;

  function dormanticizeNextTab() {
    let tab = tabs.shift();

    if (tab && shouldDormanticizeTab(tab)) {
      dormanticizeTab(tab);
      numDormanticized++;
    }

    if (numDormanticized < 10 && tabs.length) {
      let window = tab.ownerDocument.defaultView;
      window.setTimeout(dormanticizeNextTab, 0);
    }
  }

  if (gBrowser) {
    tabs = Array.slice(gBrowser.tabs);
    dormanticizeNextTab();
  }
}

function setupWindow(window) {
  if (Wu.isBrowser(window)) {
    Timer.setInterval(function() periodicTabCheck(window), TabCheckIntervalMs);
    window.gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect, false);
  }
}
function unsetupWindow(window) {
  if (Wu.isBrowser(window))
    window.gBrowser.tabContainer.removeEventListener("TabSelect", onTabSelect, false);
}

new Wu.WindowTracker({
  onTrack: setupWindow,
  onUntrack: unsetupWindow
});
