"use strict";

import { Logger } from "../utility/Logger.js";
import { log } from "./globals.js";

export class Setting {
    #value;
    // options = { onChange = (newValue, oldValue) => {} }
    constructor(name, description, defaultValue, options = {}) {
        if (this.constructor === Setting)
            throw new Error("Setting is an abstract class");
        this.name = name;
        this.description = description;
        this.defaultValue = defaultValue;
        this.onChange = options.onChange ?? ((newValue, oldValue) => {});
        this.#value = this.defaultValue;
    }

    isValueAllowed(value) {
        return [true];
    }

    get value() {
        return this.#value;
    }

    set value(value) {
        const [isValueAllowed, reason] = this.isValueAllowed(value);
        if (!isValueAllowed)
            throw new Error(reason);
        const oldValue = this.#value;
        this.#value = value;
        this.onChange(value, oldValue);
    }
}

export class BoolSetting extends Setting {
    // options = { onChange = (newValue, oldValue) => {} }
    constructor(name, description, defaultValue, options = {}) {
        super(name, description, defaultValue, options);
    }
}

export class StringSetting extends Setting {
    // options = { onChange = (newValue, oldValue) => {}, minLength = 0, maxLength = 64, pattern = "" }
    constructor(name, description, defaultValue, options = {}) {
        super(name, description, defaultValue, options);
        this.minLength = options.minLength ?? 0;
        this.maxLength = options.maxLength ?? 64;
        this.pattern = options.pattern ?? "";
    }
}

export class NumberSetting extends Setting {
    // options = { onChange = (newValue, oldValue) => {}, min = -Infinity, max = Infinity }
    constructor(name, description, defaultValue, options = {}) {
        super(name, description, defaultValue, options);
        this.min = options.min ?? -Infinity;
        this.max = options.max ?? Infinity;
    }

    isValueAllowed(value) {
        if (value < this.min) {
            return false, `Setting value must be more or equal to ${this.min}, not ${value}`;
        }
        if (value > this.max) {
            return false, `Setting value must be less or equal to ${this.max}, not ${value}`;
        }
        return [true];
    }
}

export class SingleValuesSetting extends Setting {
    // options = { onChange = (newValue, oldValue) => {} }
    constructor(name, description, defaultValue, possibleValues, options = {}) {
        super(name, description, defaultValue, options);
        this.possibleValues = possibleValues;
    }

    isValueAllowed(value) {
        if (!this.possibleValues.includes(value))
            return false, `Setting value must be one of [${this.possibleValues.join(", ")}], not ${value}`;
        return [true];
    }
}

export class Settings {
    constructor(load = true,
        closeWhenSendingViaAction = new BoolSetting(
            "Close tabs when sending via the extension button on toolbar",
            "If true, will close the tabs being sent when sending via the extension button on toolbar",
            true
        ),
        logLevel = new SingleValuesSetting(
            "Log level",
            "Level at which the logger will work",
            "INFO",
            ["DEBUG", "INFO", "WARN", "ERROR"],
            {
                onChange: (newValue) => log.level = Logger.Levels[newValue],
            }
        ),
        profilerEnabled = new BoolSetting("Profiler enabled", "If true, profiling will be done in console at debug level", false),
        fetchUndefinedFavicons = new BoolSetting("Fetch undefined favicons", "If true, will try to fetch the undefined favicons", true),
        faviconsCleanupFrequency = new NumberSetting("Favicons cleanup frequency", "Frequency in hours at which the favicons will be cleaned from redundant", 24, { min: 1 }),
    ) {
        this.closeWhenSendingViaAction = closeWhenSendingViaAction;
        this.logLevel = logLevel;
        this.profilerEnabled = profilerEnabled;
        this.fetchUndefinedFavicons = fetchUndefinedFavicons;
        this.faviconsCleanupFrequency = faviconsCleanupFrequency;

        if (load) {
            this.load();
        }
        // just to be sure that it's synced
        window.addEventListener("storage", () => {
            this.load();
        });
    }

    save() {
        const toSave = [];
        for (const key in this) {
            if (this[key] instanceof Setting)
                toSave.push([key, this[key].value]);
        }
        let settings = JSON.stringify(toSave);
        localStorage.setItem("settings", settings);
    }

    // load is not async so that it can be called in static initialization blocks
    load() {
        let settings = JSON.parse(localStorage.getItem("settings"));
        if (settings === null) {
            return;
        }
        for (const [key, value] of settings) {
            if (this[key] !== undefined)
                this[key].value = value;
        }
    }
}