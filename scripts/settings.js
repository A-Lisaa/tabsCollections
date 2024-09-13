"use strict";


export class Setting {
    #value;
    constructor(name, description, defaultValue) {
        if (this.constructor === Setting)
            throw new Error("Setting is an abstract class");
        this.name = name;
        this.description = description;
        this.defaultValue = defaultValue;
        this.#value = defaultValue;
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
        this.#value = value;
    }
}

export class BoolSetting extends Setting {
    constructor(name, description, defaultValue) {
        super(name, description, defaultValue);
    }
}

export class StringSetting extends Setting {
    constructor(name, description, defaultValue, minLength = 0, maxLength = 64, pattern = "") {
        super(name, description, defaultValue);
        this.minLength = minLength;
        this.maxLength = maxLength;
        this.pattern = pattern;
    }
}

export class NumberSetting extends Setting {
    constructor(name, description, defaultValue, min = -Infinity, max = Infinity) {
        super(name, description, defaultValue);
        this.min = min;
        this.max = max;
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
    constructor(name, description, defaultValue, possibleValues) {
        super(name, description, defaultValue);
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
            ["DEBUG", "INFO", "WARN", "ERROR"]
        ),
        profilerEnabled = new BoolSetting("Profiler enabled", "If true, profiling will be done in console at debug level", false),
        fetchUndefinedFavicons = new BoolSetting("Fetch undefined favicons", "If true, will try to fetch the undefined favicons", true),
        faviconsCleanupFrequency = new NumberSetting("Favicons cleanup frequency", "Frequency in hours at which the favicons will be cleaned from redundant", 24, 1),
    ) {
        this.closeWhenSendingViaAction = closeWhenSendingViaAction;
        this.logLevel = logLevel;
        this.profilerEnabled = profilerEnabled;
        this.fetchUndefinedFavicons = fetchUndefinedFavicons;
        this.faviconsCleanupFrequency = faviconsCleanupFrequency;

        if (load) {
            this.load();
        }
    }

    async save() {
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