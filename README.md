This is the Dormancy add-on for Firefox. While Firefox 9 adds restore-on-demand for users that restore their session by default, many users will never benefit from it. This add-on targets users who don't restore session, but do have long-running instances of Firefox and many tabs.

* Removes the contents of inactive tabs from memory if they have not been active in a while.
* Restores the state of those dormant tabs when the tab is selected.

NOTE: This is highly experimental, has only been tested on the Nightly builds, and probably will destroy your session. You've been warned.

Tabs are considered inactive when they haven't been selected in longer than 5 minutes. To change that, set this pref to a value in milliseconds:

* extensions.dormancy.TabDormancyAgeMs

Tabs are checked for inactivity every 5 minutes. To change this, set this pref to a value in milliseconds:

* extensions.dormancy.TabCheckIntervalMs
