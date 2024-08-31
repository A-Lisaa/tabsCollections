"use strict";

import { Collection } from "../../scripts/Collection.js";
import { Tab } from "../../scripts/Tab.js";
import { liveQuery } from "../../scripts/dexie.min.js";
import { db } from "../../scripts/globals.js";
import { funcPerformance } from "../../scripts/utility.js";

(async function() {
    async function getCollectionButton(collection) {
        const div = document.createElement("div");
        div.classList.add("d-flex");
        div.innerHTML = `
            <button
                class="btn btn-outline-secondary rounded-0 text-start my-auto flex-fill"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collection-${collection.id}-subelements"
                aria-expanded="true"
                aria-controls="collection-${collection.id}-subelements"
            />
            <button
                class="btn btn-outline-danger rounded-0 ms-1"
                type="button"
                data-bs-toggle="popover"
                data-bs-placement="bottom"
                data-bs-html="true"
                data-bs-trigger="focus"
                data-bs-title="Are you sure?"
                data-bs-content="
                    <a class='btn btn-outline-danger rounded-0' type='button'>Yes</a>
                    <a class='btn btn-outline-primary rounded-0' type='button'>No</a>
                "
            >
                Delete
            </button>
            <button
                class="btn btn-outline-primary rounded-0 ms-1"
                type="button"
                data-bs-toggle="modal"
                data-bs-target="#collectionModal"
            >
                Edit
            </button>
        `;
        const [collapseButton, deleteButton, editButton] = div.querySelectorAll("button");
        collapseButton.textContent = `${collection.title} | ${collection.tabs.length} tab(s)`;

        new bootstrap.Popover(deleteButton);
        deleteButton.addEventListener("shown.bs.popover", async (event) => {
            // popovers are very unreliable, need a way to always get the one that opened
            const popover = document.getElementById(event.target.attributes["aria-describedby"].value);
            const [deleteButtonYes, deleteButtonNo] = popover.querySelectorAll("a");
            deleteButtonYes.addEventListener("click", async () => {
                await collection.delete();
                deleteButton.click();
            });
            deleteButtonNo.addEventListener("click", () => { deleteButton.click() });
        });

        editButton.addEventListener("click", () => {});

        return div;
    }
    getCollectionButton = funcPerformance(getCollectionButton);

    async function getCollectionRows(tabs) {
        const rows = [];
        for (const tab of tabs) {
            const tr = document.createElement('tr');
            tr.setAttribute('tab-id', tab.id);

            const closeBtn = document.createElement("td");
            closeBtn.style = "padding: .1rem .1rem;"
            const btn = document.createElement("button");
            btn.type = "button";
            btn.classList.add("btn-close", "align-middle", "invisible");
            btn.addEventListener("click", async () => {
                await tab.delete();
            });
            closeBtn.append(btn);

            const favicon = document.createElement("td");
            favicon.style = "padding: .1rem .1rem;"
            const image = document.createElement("img");
            image.src = tab.favicon ?? '';
            image.style = "width: 16px; height: 16px;";
            favicon.append(image);

            const title = document.createElement("td");
            title.classList.add("text-truncate");
            title.style = "padding: .1rem .1rem;"
            const titleText = document.createElement("a");
            titleText.classList.add("link-light", "link-underline", "link-offset-2", "link-offset-3-hover", "link-underline-opacity-0", "link-underline-opacity-75-hover");
            titleText.href = tab.url;
            titleText.textContent = tab.title ?? "No title";
            titleText.setAttribute("data-bs-toggle", "tooltip");
            titleText.setAttribute("data-bs-title", titleText.textContent);
            titleText.setAttribute("data-bs-delay", "500");
            new bootstrap.Tooltip(titleText);
            title.append(titleText);

            const url = document.createElement("td");
            url.classList.add("text-truncate");
            url.style = "padding: .1rem .1rem;"
            const a = document.createElement("a");
            a.href = tab.url;
            a.textContent = decodeURI(tab.url);
            a.setAttribute("data-bs-toggle", "tooltip");
            a.setAttribute("data-bs-title", a.textContent);
            a.setAttribute("data-bs-delay", "500");
            new bootstrap.Tooltip(a);
            url.append(a);

            const creationTime = document.createElement("td");
            creationTime.style = "padding: .1rem .1rem;"
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
        // let's just hope that font-size doesn't get changed
        const fontSize = 8;
        const div = document.createElement("div");
        div.id = `collection-${collection.id}-subelements`;
        div.classList.add("collapse", "show", "my-1");
        div.innerHTML = `
            <table class="table-sort table-arrows table table-sm table-borderless" style="table-layout: fixed;">
                <thead>
                    <tr>
                        <th scope="col" style="width: 32px;"></th>
                        <th scope="col" style="width: 24px;"></th>
                        <th scope="col">Title</th>
                        <th scope="col">URL</th>
                        <th scope="col" style="width: ${new Date().toLocaleString().length * fontSize}px;">Creation Time</th>
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

    async function showCollectionTabs(collectionId, tabs) {
        const div = document.querySelector(`div[collection-id="${collectionId}"]`);
        const collapser = div.querySelector("button");
        collapser.textContent = `${collapser.textContent.split(" | ")[0]} | ${tabs.length} tab(s)`;

        const tbody = div.querySelector("tbody");
        tbody.innerHTML = "";
        tbody.append(...await getCollectionRows(tabs));
    }
    showCollectionTabs = funcPerformance(showCollectionTabs);

    const observables = new Map();

    async function showCollection(collection) {
        const observable = await collection.getObservable();
        observable.subscribe({
            next: funcPerformance(
                async (result) => {
                    const favicons = await Collection.getFavicons();
                    const tabs = await Promise.all(result.map((tab) => Tab.fromObject(tab, favicons)));
                    await showCollectionTabs(collection.id, tabs);
                },
                `Collection(${collection.title}) observer`
            )
        });
        observables.set(collection.id, observable);
        const collectionDiv = await getCollectionElement(collection);
        document.getElementById("collections").append(collectionDiv);
    }
    showCollection = funcPerformance(showCollection);

    const collectionsObservable = liveQuery(
        () => db.collections.toArray()
    );

    collectionsObservable.subscribe(async (collections) => {
        observables.clear();
        document.getElementById("collections").innerHTML = "";
        for (const collectionObject of collections) {
            const collection = await Collection.fromObject(collectionObject);
            showCollection(collection);
        }
    });

    async function createCollection() {
        document.getElementById("collectionModalSaveButton").addEventListener("click", () => {
            const title = document.getElementById("collectionModalTitle").value.trim();
            const filters = document.getElementById("collectionModalFilters").value.trim().split("\n");
            Collection.create(title, filters);
        });
    }

    async function addHandlers() {
        document.getElementById("createCollection").addEventListener("click", createCollection);
    }

    async function main() {
        await addHandlers();
    }

    document.addEventListener("DOMContentLoaded", main);
})();