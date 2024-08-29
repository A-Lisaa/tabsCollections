"use strict";


export class Settings {
    constructor(debugEnabled = true, performanceEnabled = true, fetchUndefinedFavicons = true) {
        this.debugEnabled = debugEnabled;
        this.performanceEnabled = performanceEnabled;
        this.fetchUndefinedFavicons = fetchUndefinedFavicons;
    }

    async save() {
        let settings = JSON.stringify(this);
        localStorage.setItem("settings", settings);
    }

    // load is not async so that it can be called in static initialization blocks
    static load() {
        let settings = localStorage.getItem("settings");
        if (settings === null) {
            return new Settings();
        }
        return JSON.parse(settings);
    }
}