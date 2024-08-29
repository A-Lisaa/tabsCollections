"use strict";

import { Collection } from "../../scripts/Collection.js";
import { Tab } from "../../scripts/Tab.js";
import { db } from "../../scripts/globals.js";
import { funcPerformance } from "../../scripts/utility.js";

(async function() {
    async function getCollectionButton(collection) {
        const div = document.createElement("div");
        div.classList.add("d-flex");
        div.innerHTML = `
            <button
                class="btn btn-outline-secondary my-auto flex-fill"
                style="text-align: left; border-radius: 0px;"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collection-${collection.id}-subelements"
                aria-expanded="true"
                aria-controls="collection-${collection.id}-subelements"
            />
        `;
        div.querySelector("button").textContent = `${collection.title} | ${collection.tabs.length} tab(s)`;
        return div;
    }
    getCollectionButton = funcPerformance(getCollectionButton);

    async function getCollectionRows(tabs) {
        const rows = [];
        for (const tab of tabs) {
            const tr = document.createElement('tr');
            tr.setAttribute('tab-id', tab.id);

            const closeBtn = document.createElement("td");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.classList.add("btn-close", "align-middle", "invisible", tab.id);
            btn.addEventListener("click", async () => {
                await db.tabs.delete(tab.id);
            });
            closeBtn.append(btn);

            const favicon = document.createElement("td");
            const image = document.createElement("img");
            image.src = tab.favicon ?? '';
            image.style = "width: 16px; height: 16px;";
            favicon.append(image);

            const title = document.createElement("td");
            title.textContent = tab.title ?? "No title";

            const url = document.createElement("td");
            const a = document.createElement("a");
            a.href = tab.url;
            a.textContent = tab.url;
            url.append(a);

            const creationTime = document.createElement("td");
            creationTime.textContent = tab.creationTime.toLocaleString();

            tr.append(closeBtn, favicon, title, url, creationTime);

            tr.addEventListener("mouseenter", (event) => {
                event.target.querySelector("button").classList.remove("invisible");
            });
            tr.addEventListener("mouseleave", (event) => {
                event.target.querySelector("button").classList.add("invisible");
            });

            rows.push(tr);
        }
        return rows;
    }
    getCollectionRows = funcPerformance(getCollectionRows);

    async function getCollectionTable(collection) {
        const div = document.createElement("div");
        div.id = `collection-${collection.id}-subelements`;
        div.classList.add("collapse", "show", "my-1");
        div.innerHTML = `
            <table class="table-sort table-arrows table table-sm table-borderless">
                <thead>
                    <tr>
                        <th scope="col"></th>
                        <th scope="col"></th>
                        <th scope="col">Title</th>
                        <th scope="col">URL</th>
                        <th scope="col">Creation Time</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        `;
        //div.querySelector('tbody').append(...await getCollectionRows(collection.tabs));
        return div;
    }
    getCollectionTable = funcPerformance(getCollectionTable);

    async function getCollectionElement(collection) {
        const div = document.createElement("div");
        div.classList.add("mb-2");
        div.setAttribute("collection-id", collection.id);
        div.append(await getCollectionButton(collection), await getCollectionTable(collection));
        return div;
    }
    getCollectionElement = funcPerformance(getCollectionElement);

    const observables = new Map();

    async function showCollections() {
        const ids = await db.collections.toCollection().primaryKeys();
        for (const id of ids) {
            const collection = await Collection.fromDB(id);
            const observable = await collection.getObservable();
            observable.subscribe({
                next: funcPerformance(
                    async (result) => {
                        if (result.length === 0)
                            return;
                        const favicons = await Collection.getFavicons();
                        const tabs = await Promise.all(result.map((tab) => Tab.fromObject(tab, favicons)));
                        const id = tabs[0].collectionId;
                        const div = document.querySelector(`div[collection-id="${id}"]`);
                        const collapser = div.querySelector("button");
                        collapser.textContent = `${collapser.textContent.split(" | ")[0]} | ${tabs.length} tab(s)`;
                        const tbody = div.querySelector("tbody");
                        tbody.innerHTML = "";
                        tbody.append(...await getCollectionRows(tabs));
                    },
                    `Collection ${id} observer`
                )
            });
            observables.set(id, observable);
            const collectionDiv = await getCollectionElement(collection);
            document.getElementById("collections").append(collectionDiv);
        }
    }
    showCollections = funcPerformance(showCollections);

    async function createCollection() {
        const collection = Collection.fromPrompt();
    }

    async function addHandlers() {
        document.getElementById("createCollection").addEventListener("click", createCollection);
    }

    async function main() {
        await addHandlers();
        await showCollections();
    }

    document.addEventListener("DOMContentLoaded", main);
})();