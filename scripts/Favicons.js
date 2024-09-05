"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { md5 } from "../modules/md5.min.js";
import { db, log, settings } from "./globals.js";
import { classPerformance, funcPerformance } from "./profiler.js";

export class Favicons {
    static #faviconsObservable;
    static cache = null;

    static getCacheSize() {
        if (!settings.cacheFavicons)
            return null;
        let size = 0;
        for (const image of Favicons.cache.values()) {
            size += (typeof image === "string") ? new Blob([image]).size : image.size;
        }
        return size;
    }

    static {
        if (settings.cacheFavicons) {
            Favicons.#faviconsObservable = liveQuery(
                () => db.favicons.toArray()
            )

            Favicons.#faviconsObservable.subscribe(funcPerformance(
                    async (favicons) => {
                        Favicons.cache = await Favicons.fromDBArray(favicons);
                        log.debug(`%cFavicons.cache size = ${Favicons.getCacheSize()/1024} KB`, "color: #bada55;");
                    },
                    "Favicons observable"
                )
            );
        }
    }

    static async convertDBImage(image) {
        if (typeof image === "string")
            // image is a string with url
            return image;
        // image is an ArrayBuffer with image object ready to be displayed
        return new Blob([image]);
    }

    static async fromDBArray(favicons) {
        return new Map(await Promise.all(favicons.map(
            async ({ hash, image }) => [
                hash,
                await Favicons.convertDBImage(image)
            ]
       )));
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

        if (await Favicons.exists(hash))
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
        const toStore = [];
        for (let favicon of favicons) {
            if (favicon === undefined) {
                results.push(undefined);
                continue;
            }

            const hash = md5(favicon);

            // the favicon has already been prepared for storing or already exists
            if (results.includes(hash) || await Favicons.exists(hash)) {
                results.push(hash);
                continue;
            }
            results.push(hash);

            if (favicon.startsWith("data:image")) {
                favicon = await Favicons.resize(favicon);
                favicon = await favicon.arrayBuffer();
            }
            toStore.push({ hash: hash, image: favicon });
        }
        db.favicons.bulkAdd(toStore);
        return results;
    }

    static async getAll() {
        if (settings.cacheFavicons)
            return Favicons.cache;
        return Favicons.fromDBArray(await db.favicons.toArray());
    }

    static async cleanup() {
        const [tabs, favicons] = await db.transaction("r", db.tabs, db.favicons, () => {
            return Promise.all([
                db.tabs.toArray(),
                db.favicons.toArray(),
            ]);
        });
        const hashes = new Set(tabs.map((tab) => tab.faviconHash));
        const toDelete = favicons.filter((favicon) => !hashes.has(favicon));
        db.favicons.bulkDelete(toDelete);
        log.info("Favicons cleanup ran");
    }

    static {
        classPerformance(Favicons);
    }
}