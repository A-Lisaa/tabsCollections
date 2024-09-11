"use strict";

import { Logger } from "../utility/Logger.js";

export class Setting {
    getInputElement(template) {
        throw new Error("Not implemented");
    }
}

export class CheckboxSetting extends Setting {
    getInputElement() {
        return this.element.querySelector("input[type='checkbox']");
    }
}

export class Settings {
    constructor(load = true,
        logLevel = Logger.Levels.INFO,
        performanceEnabled = false,
        fetchUndefinedFavicons = true,
        faviconsCleanupFrequency = 24*60*60*1000,
    ) {
        this.logLevel = logLevel;
        this.performanceEnabled = performanceEnabled;
        this.fetchUndefinedFavicons = fetchUndefinedFavicons;
        this.faviconsCleanupFrequency = faviconsCleanupFrequency;

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