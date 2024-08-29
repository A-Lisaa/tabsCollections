"use strict";

import { Collection } from "./Collection.js";
import { Dexie } from "./dexie.min.js";
import { Settings } from "./settings.js";

export async function openDB() {
    const DBNAME = "tabsCollections";

    const db = new Dexie(DBNAME);

    db.version(1).stores({
        collections: "++id, &title",
        tabs: "++id, collectionId",
        favicons: "&hash"
    });

    db.on("populate", () => {
        Collection.create("default");
    });

    return db;
}

export const settings = Settings.load();

export const db = await openDB();