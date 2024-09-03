"use strict";

export class Logger {
    static Levels = {
        DEBUG: 10,
        INFO: 20,
        WARN: 30,
        ERROR: 40
    }

    constructor(level = Logger.Levels.INFO) {
        this.level = level;
    }

    debug(...values) {
        if (this.level > Logger.Levels.DEBUG)
            return;
        console.debug(...values);
    }

    info(...values) {
        if (this.level > Logger.Levels.INFO)
            return;
        console.info(...values);
    }

    warn(...values) {
        if (this.level > Logger.Levels.WARN)
            return;
        console.warn(...values);
    }

    error(...values) {
        if (this.level > Logger.Levels.ERROR)
            return;
        console.error(...values);
    }
}