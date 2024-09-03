"use strict";

import { liveQuery } from "../../scripts/dexie.min.js";
import { md5 } from "../modules/md5.min.js";
import { db, log, settings } from "./globals.js";
import { Settings } from "./Settings.js";
import { classPerformance, funcPerformance } from "./utility.js";

export class Favicons {
    static #faviconsObservable;
    static cache = null;

    static getCacheSize() {
        if (!new Settings().cacheFavicons)
            return null;
        let size = 0;
        for (const image of Favicons.cache.values()) {
            size += (typeof image === "string") ? new Blob([image]).size : image.size;
        }
        return size;
    }

    static {
        const settings = new Settings();
        if (settings.cacheFavicons) {
            log.info("Caching favicons");
            Favicons.#faviconsObservable = liveQuery(
                () => db.favicons.toArray()
            )

            Favicons.#faviconsObservable.subscribe({
                next: funcPerformance(
                    async (favicons) => {
                        Favicons.cache = new Map();
                        for (const { hash, image } of favicons) {
                            if (typeof image === "string") {
                                Favicons.cache.set(hash, image);
                            }
                            else {
                                Favicons.cache.set(hash, new Blob([image]));
                            }
                        }
                        log.debug(`%cFavicons.cache size = ${Favicons.getCacheSize()/1024} KB`, "color: #bada55;");
                    },
                    "Favicons observable"
                )
            });
        }
    }

    static async resize(favicon) {
        const canvas = new OffscreenCanvas(16, 16);
        const context = canvas.getContext("2d");
        const img = new Image(16, 16);
        img.src = favicon;
        await img.decode();
        context.drawImage(img, 0, 0, 16, 16);
        return canvas.convertToBlob();
    }

    static async exists(faviconHash) {
        if (settings.cacheFavicons) {
            if (Favicons.cache.has(faviconHash))
                return true;
            return false;
        }
        else {
            if ((await db.favicons.get(faviconHash)) !== undefined)
                return true;
            return false;
        }
    }

    static async store(favicon) {
        const hash = md5(favicon);

        // md5 already exists
        if (Favicons.exists(hash))
            return hash;

        if (favicon.startsWith("data:image")) {
            favicon = await Favicons.resize(favicon);
            favicon = await favicon.arrayBuffer();
        }
        db.favicons.add({ hash: hash, image: favicon });
        return hash;
    }

    static async bulkStore(favicons) {
        const results = [];
        const prepared = [];
        for (let favicon of favicons) {
            if (favicon === undefined) {
                results.push(undefined);
                continue;
            }

            const hash = md5(favicon);

            if (results.includes(hash) || await Favicons.exists(hash)) {
                results.push(hash);
                continue;
            }
            results.push(hash);

            if (favicon.startsWith("data:image")) {
                favicon = await Favicons.resize(favicon);
                favicon = await favicon.arrayBuffer();
            }
            prepared.push({ hash: hash, image: favicon });
        }
        db.favicons.bulkAdd(prepared);
        return results;
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