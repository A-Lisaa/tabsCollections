"use strict";

import { Collection } from "./Collection.js";
import { Dexie } from "./dexie.min.js";

export async function openDB() {
    const DBNAME = "tabsCollections";

    let db = new Dexie(DBNAME);

    db.version(1).stores({
        collections: "&title",
        favicons: "&hash"
    });

    db.on("populate", () => {
        db.collections.add(new Collection("default"));
    });

    return db;
}