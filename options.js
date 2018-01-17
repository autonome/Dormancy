'use strict';

(async () => {
  const storageKey = 'dormancy.configuration';

  // Get default settings from manifest
  let manifest = await browser.runtime.getManifest();
  let cfg = manifest.options;

  // Initialize storage
  async function initStorage() {
    // TEST
    //await clear();

    // TODO: why doesn't await work here? no exception thrown, but dat.gui doesn't render 
    browser.storage.local.get(storageKey).then(onStorage, console.error);
  }

  // When storage data is available
  async function onStorage(data) {
    // Load user settings
    if (data && data[storageKey]) {
      cfg = data[storageKey];
    }

    // Initialize dat.GUI
    let gui = new dat.GUI({
      autoPlace: false
    });

    // Add setting to dat.GUI, set up event handler
    gui.add(cfg, 'timeout', 1, 60, 1).onChange(save);

    // Add dat.GUI to extension UI
    document.body.appendChild(gui.domElement);
  }

  // Initialize storage on page load
  function onLoad() {
    initStorage();
  }
  window.onload = onLoad;

  // Save data to local storage
  async function save() {
    let saveData = {};
    saveData[storageKey] = cfg;
    browser.storage.local.set(saveData).then(null, console.error);
  }
  
  /*
  // Test for clearing local storage
  async function clear() {
    await browser.storage.local.clear().then(() => console.log('cleared'), e => console.log(e));
  }
  */

})();
