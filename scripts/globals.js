"use strict";

import { Dexie } from "../modules/dexie.min.js";
import { Collection } from "./Collection.js";
import { Logger } from "./Logger.js";
import { Settings } from "./Settings.js";

export async function openDB() {
    const DBNAME = "tabsCollections";

    const db = new Dexie(DBNAME);

    db.version(1).stores({
        collections: "++id",
        tabs: "++id, collectionId",
        favicons: "&hash"
    });

    db.on("populate", () => {
        Collection.create("default", ["/.+/"]);
    });

    return db;
}

export const settings = new Settings();
settings.logLevel = Logger.Levels.DEBUG;

export const db = await openDB();

export const log = new Logger(settings.logLevel);