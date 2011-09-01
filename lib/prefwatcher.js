const {Cc, Ci, Cu, Cm} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm', this);

// keyed on prefname, value is array of callbacks
let observers = {};

const Prefs = Services.prefs;
const Prefs2 = Prefs.QueryInterface(Ci.nsIPrefBranch2);  
const PrefsJP = require('preferences-service');

exports.watch = function prefWatch(pref, callback) {
  Prefs.addObserver(pref, prefObserver, false);
  if (!observers[pref])
    observers[pref] = [];
  observers[pref].push(callback);
  callback(PrefsJP.get(pref));
};

exports.unwatch = function prefUnwatch(pref, callback) {
  if (observers[pref] && observers[pref].indexOf(callback) != -1)
    observers[pref].splice(obervers[pref].indexOf(callback), 1);
};

let prefObserver = {
  observe: function observe(s, t, pref) {
    if (observers[pref]) {
      let newVal = PrefsJP.get(pref);
      console.log("updating ", pref, " to ", newVal);
      observers[pref].forEach(function(callback) callback(newVal));
    }
  }
};

require('unload').when(function() {
  for (let [pref, vars] in Iterator(observers)) {
    Prefs2.removeObserver(pref, prefObserver);
    observers[pref].splice(0);
  }
});
