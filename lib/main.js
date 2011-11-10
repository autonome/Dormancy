const {Cc, Ci, Cu, Cm} = require('chrome');
const Ss = Cc["@mozilla.org/browser/sessionstore;1"].
           getService(Ci.nsISessionStore);
const Timer = require('timer');
const Wu = require("window-utils");
const PrefWatcher = require("prefwatcher");

const PREF_PREFIX = "extensions.dormancy.";

// Age at which tabs should be dormanticized (default 5 mins)
let TabDormancyAgeMs = 5 * 60 * 1000;
PrefWatcher.watch(PREF_PREFIX + "TabDormancyAgeMs",
                  function(val) TabDormancyAgeMs = val || TabDormancyAgeMs);

// How often to cull tabs (default 5 minutes)
let TabCheckIntervalMs = 5 * 60 * 1000;
PrefWatcher.watch(PREF_PREFIX + "TabCheckIntervalMs",
                  function(val) TabCheckIntervalMs = val || TabCheckIntervalMs);

// UNUSED From sessionstore component.
const TAB_STATE_NEEDS_RESTORE = 1;

function tabIsDormant(tab) {
  // don't touch ROD tabs
  let isInternallyDormant =
    tab.linkedBrowser.__SS_restoreState &&
    tab.linkedBrowser.__SS_restoreState == TAB_STATE_NEEDS_RESTORE;
  if (isInternallyDormant)
    return true;
  // if there's a previous tab state, it's dormant by us
  return Ss.getTabValue(tab, "previousTabState").length;
}

// check age. if no age, set it.
function tabIsOld(tab) {
  let lastActive = Ss.getTabValue(tab, "lastActive");
  if (!lastActive) {
    // For lack of a better option
    Ss.setTabValue(tab, "lastActive", Date.now());
    return false;
  }
  else if (Date.now() - lastActive >= TabDormancyAgeMs)
    return true;
  return false;
}

function tabIsSelected(tab) tab.ownerDocument.defaultView.gBrowser.selectedTab == tab

// save a tab's state
// create a new state for it, with title and favicon, but url is about:blank
// save old state as a tab value
// on tab select, restore old state
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
  let gBrowser = window.gBrowser;
  if (gBrowser) {
    // iterate over tabs
    for (var i = 0; i < gBrowser.tabContainer.childNodes.length; i++) {
      var tab = gBrowser.tabContainer.childNodes[i];

      if (tabIsDormant(tab) || tabIsSelected(tab) || tab.getAttribute("pinned"))
        continue;

      if (tabIsOld(tab))
        dormanticizeTab(tab);
    }
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
