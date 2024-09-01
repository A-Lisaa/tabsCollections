"use strict";

import { liveQuery } from "../../scripts/dexie.min.js";
import { db, settings } from "./globals.js";
import { md5 } from "./md5.min.js";
import { Settings } from "./settings.js";
import { classPerformance } from "./utility.js";

export class Favicons {
    static #faviconsObservable;
    static cache;

    static {
        const settings = Settings.load();
        if (settings.cacheFavicons) {
            console.log("Caching favicons");
            Favicons.#faviconsObservable = liveQuery(
                () => db.favicons.toArray()
            )
            Favicons.cache = new Map();

            Favicons.#faviconsObservable.subscribe(async (result) => {
                for (const { hash, image } of result) {
                    Favicons.cache.set(hash, image);
                }
                if (settings.debugEnabled) {
                    let size = 0;
                    for (const [hash, image] of Favicons.cache.entries()) {
                        size += new Blob([hash + image]).size;
                    }
                    console.log(`%cFavicons.cache size = ${size/1024} KB`, "color: #bada55;");
                }
            });
        }
    }

    static async store(favicon) {
        let faviconHash = md5(favicon);
        if (!settings.cacheFavicons || !Favicons.cache.has(faviconHash))
            db.favicons.put({ hash: faviconHash, image: favicon });
        return faviconHash;
    }

    static async getAll() {
        if (settings.cacheFavicons) {
            return Favicons.cache;
        }
        const favicons = new Map();
        await db.favicons.toCollection().each(({ hash, image }) => {
            favicons.set(hash, image);
        });
        return favicons;
    }

    static async cleanup() {
        const [tabs, favicons] = Promise.all([
            db.tabs.toArray(),
            db.favicons.toArray(),
        ]);
        const hashes = new Set(tabs.map((tab) => tab.faviconHash));
        Promise.all(favicons.map((favicon) => {
            if (!hashes.has(favicon.hash)) {
                db.favicons.delete(favicon.hash);
            }
        }));
    }

    static {
        classPerformance(Favicons);
    }
}