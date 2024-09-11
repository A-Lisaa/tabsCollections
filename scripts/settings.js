"use strict";

import { Logger } from "../utility/Logger.js";

export class Settings {
    constructor(load = true,
        logLevel = Logger.Levels.INFO,
        performanceEnabled = false,
        fetchUndefinedFavicons = true,
        faviconsCleanupFrequency = 24*60*60*1000,
        faviconsSize = 16
    ) {
        this.logLevel = logLevel;
        this.performanceEnabled = performanceEnabled;
        this.fetchUndefinedFavicons = fetchUndefinedFavicons;
        this.faviconsCleanupFrequency = faviconsCleanupFrequency;
        this.faviconsSize = faviconsSize;

        if (load) {
            this.load();
        }
    }

    async save() {
        let settings = JSON.stringify(this);
        localStorage.setItem("settings", settings);
    }

    // load is not async so that it can be called in static initialization blocks
    load() {
        let settings = localStorage.getItem("settings");
        if (settings === null) {
            return;
        }
        for (let key in settings) {
            this[key] = settings[key];
        }
    }
}