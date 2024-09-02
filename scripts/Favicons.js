"use strict";

import { liveQuery } from "../../scripts/dexie.min.js";
import { db, settings } from "./globals.js";
import { md5 } from "./md5.min.js";
import { Settings } from "./settings.js";
import { classPerformance, funcPerformance } from "./utility.js";

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

            Favicons.#faviconsObservable.subscribe({
                next: funcPerformance(
                    async (result) => {
                        Favicons.cache = new Map();
                        for (const { hash, image } of result) {
                            if (typeof image === "string") {
                                Favicons.cache.set(hash, image);
                            }
                            else {
                                Favicons.cache.set(hash, new Blob([image]));
                            }
                        }
                        if (settings.debugEnabled) {
                            let size = 0;
                            for (const image of Favicons.cache.values()) {
                                size += (typeof image === "string") ? new Blob([image]).size :  image.size;
                            }
                            console.log(`%cFavicons.cache size = ${size/1024} KB`, "color: #bada55;");
                        }
                    },
                    "Favicons observable"
                )
            });
        }
    }

    static #canvas = new OffscreenCanvas(16, 16);
    static #context = Favicons.#canvas.getContext("2d");
    static #img = new Image(16, 16);

    static async resize(favicon) {
        Favicons.#img.src = favicon;
        Favicons.#context.reset();
        Favicons.#context.drawImage(Favicons.#img, 0, 0, 16, 16);
        return Favicons.#canvas.convertToBlob();
    }

    static async store(favicon) {
        const hash = md5(favicon);

        // md5 already exists
        if (settings.cacheFavicons && Favicons.cache.has(hash))
            return hash;
        else if ((await db.favicons.get(hash)) !== undefined)
            return hash;

        if (favicon.startsWith("data:image")) {
            favicon = await Favicons.resize(favicon);
            favicon = await favicon.arrayBuffer();
        }
        db.favicons.add({ hash: hash, image: favicon });
        return hash;
    }

    static async bulkStore(favicons) {
        // TODO: well, this
        const prepared = await Promise.all(favicons.map(async (favicon) => {
            const hash = md5(favicon);

            if (settings.cacheFavicons && Favicons.cache.has(hash))
                return hash;
            else if ((await db.favicons.get(hash)) !== undefined)
                return hash;

            if (favicon.startsWith("data:image")) {
                favicon = await Favicons.resize(favicon);
                favicon = await favicon.arrayBuffer();
            }
            return hash;
        }));
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