"use strict";


export class Settings {
    constructor(debugEnabled = true, performanceEnabled = true, fetchUndefinedFavicons = true, cacheFavicons = true) {
        this.debugEnabled = debugEnabled;
        this.performanceEnabled = performanceEnabled;
        this.fetchUndefinedFavicons = fetchUndefinedFavicons;
        this.cacheFavicons = cacheFavicons;
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