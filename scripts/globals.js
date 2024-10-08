"use strict";

import { Dexie } from "../modules/dexie.min.js";
import { Logger } from "../utility/Logger.js";
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
        // the default collection is added to the db directly to not import Collection and create import issues with what Collection.js imports
        db.collections.add({ title: "default", filters: ["# matches everything", "/.+/"], priority: -1, allowDuplicates: false });
    });

    return db;
}

export const log = new Logger();

export const settings = new Settings();

export const db = await openDB();
