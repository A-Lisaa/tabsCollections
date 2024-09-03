"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { Collection } from "../../scripts/Collection.js";
import { Favicons } from "../../scripts/Favicons.js";
import { db } from "../../scripts/globals.js";
import { Tab } from "../../scripts/Tab.js";
import { funcPerformance } from "../../scripts/utility.js";

(async function() {
    async function getCollectionElementTemplate() {
        // for now assume font size is always the same
        const fontSize = 8;
        const collectionElementTemplate = document.getElementById("collectionTemplate").cloneNode(true);
        collectionElementTemplate.removeAttribute("id");
        collectionElementTemplate.removeAttribute("aria-hidden");
        collectionElementTemplate.classList.remove("d-none");
        // width of creation time column
        collectionElementTemplate.querySelectorAll("th")[4].style = `width: ${new Date().toLocaleString().length * fontSize}px;`;
        collectionElementTemplate.querySelector("tbody").replaceChildren();
        return collectionElementTemplate;
    }

    async function getTabTemplate() {
        const tabTemplate = document.getElementById("tabTemplate").cloneNode(true);
        tabTemplate.removeAttribute("id");
        tabTemplate.removeAttribute("aria-hidden");
        tabTemplate.classList.remove("d-none");
        tabTemplate.addEventListener("mouseenter", (event) => {
            event.target.querySelector(".btn-close").classList.remove("invisible");
        });
        tabTemplate.addEventListener("mouseleave", (event) => {
            event.target.querySelector(".btn-close").classList.add("invisible");
        });
        return tabTemplate;
    }

    const tabTemplate = await getTabTemplate();
    const collectionElementTemplate = await getCollectionElementTemplate();

    const collections = await Collection.getAll();

    async function setCollectionHeader(collection, { collectionHeader }) {
        const [collapseButton, deleteButton, editButton] = collectionHeader.children;

        collapseButton.setAttribute("data-bs-target", `#collection-${collection.id}-subelements`);
        collapseButton.setAttribute("aria-controls", `collection-${collection.id}-subelements`);
        collapseButton.textContent = `${collection.title} | ${collection.tabs.length} tab(s)`;

        new bootstrap.Popover(deleteButton);
        deleteButton.addEventListener("shown.bs.popover", async (event) => {
            const popover = document.getElementById(event.target.attributes["aria-describedby"].value);
            const [deleteButtonYes, deleteButtonNo] = popover.querySelectorAll("a");
            deleteButtonYes.addEventListener("click", () => {
                collection.delete();
                deleteButton.click();
            });
            deleteButtonNo.addEventListener("click", () => { deleteButton.click() });
        });

        editButton.addEventListener("click", async () => {
            document.getElementById("collectionModalTitle").value = collection.title;
            document.getElementById("collectionModalFilters").value = collection.filters.map((filter) => filter.original).join("\n");
            document.getElementById("collectionModalAllowDuplicates").value = collection.allowDuplicates;
            document.getElementById("collectionModalSaveButton").addEventListener("click", () => {
                const title = document.getElementById("collectionModalTitle").value.trim();
                const filters = document.getElementById("collectionModalFilters").value.trim().split("\n");
                const allowDuplicates = document.getElementById("collectionModalAllowDuplicates").checked;
                console.log({id: collection.id, title: title, filters: filters, allowDuplicates: allowDuplicates });
                db.collections.put({id: collection.id, title: title, filters: filters, allowDuplicates: allowDuplicates });
                collapseButton.textContent = `${title} | ${collection.tabs.length} tab(s)`;
            });
        });
    }
    setCollectionHeader = funcPerformance(setCollectionHeader);

    async function getCollectionRow(tab) {
        const row = tabTemplate.cloneNode(true);
        row.id = `tab-${tab.id}`;
        const [closeButton, favicon, title, url, creationTime] = row.children;

        closeButton.firstElementChild.addEventListener("click", () => tab.delete());

        if (tab.favicon !== undefined) {
            if (typeof tab.favicon === "string") {
                favicon.firstElementChild.src = tab.favicon;
            }
            else {
                // if tab.favicon is Blob
                const faviconUrl = URL.createObjectURL(tab.favicon);
                favicon.firstElementChild.src = faviconUrl;
                URL.revokeObjectURL(faviconUrl);
            }
        }
        else {
            favicon.firstElementChild.src = "";
        }

        const titleAnchor = title.firstElementChild;
        titleAnchor.href = tab.url;
        titleAnchor.textContent = tab.title ?? "No title";
        titleAnchor.setAttribute("data-bs-title", titleAnchor.textContent);
        new bootstrap.Tooltip(titleAnchor);

        const urlAnchor = url.firstElementChild;
        urlAnchor.href = tab.url;
        urlAnchor.textContent = decodeURI(tab.url);
        urlAnchor.setAttribute("data-bs-title", decodeURI(tab.url));
        new bootstrap.Tooltip(urlAnchor);

        creationTime.textContent = tab.creationTime.toLocaleString();

        return row;
    }

    async function setCollectionSubelements(collection, { collectionSubelements }) {
        collectionSubelements.id = `collection-${collection.id}-subelements`;
    }
    setCollectionSubelements = funcPerformance(setCollectionSubelements);

    async function getCollectionElement(collection) {
        const collectionElement = collectionElementTemplate.cloneNode(true);
        collectionElement.id = `collection-${collection.id}`;

        const [collectionHeader, collectionSubelements] = collectionElement.children;
        setCollectionHeader(collection, { collectionHeader: collectionHeader });
        setCollectionSubelements(collection, { collectionSubelements: collectionSubelements });

        return collectionElement;
    }
    getCollectionElement = funcPerformance(getCollectionElement);

    async function setCollectionText(collectionDiv, collectionSize) {
        const collapser = collectionDiv.querySelector("button");
        collapser.textContent = `${collapser.textContent.split(" | ")[0]} | ${collectionSize} tab(s)`;
    }

    const observables = new Map();

    async function createObservable(collection) {
        const observable = await collection.getObservable();
        observable.subscribe({
            next: funcPerformance(
                async (dbTabs) => {
                    const collectionDiv = document.getElementById(`collection-${collection.id}`);
                    const tbody = collectionDiv.querySelector("tbody");
                    setCollectionText(collectionDiv, dbTabs.length);

                    const pageTabs = [];
                    const pageTabsIds = new Set();
                    for (const tab of tbody.children) {
                        pageTabs.push(tab);
                        pageTabsIds.add(parseInt(tab.id.split("-")[1]));
                    }

                    const dbTabsIds = new Set(dbTabs.map((tab) => tab.id));
                    const tabsToAddIds = dbTabsIds.difference(pageTabsIds);
                    const tabsToRemoveIds = pageTabsIds.difference(dbTabsIds);

                    const favicons = await Favicons.getAll();
                    const tabsToAdd = await Promise.all(dbTabs.filter((tab) => tabsToAddIds.has(tab.id)).map((tab) => Tab.fromObject(tab, favicons)));
                    Promise.all(tabsToAdd.map(async (tab) => {
                        tbody.append(await getCollectionRow(tab));
                    }));
                    const tabsToRemove = pageTabs.filter((tab) => tabsToRemoveIds.has(parseInt(tab.id.split("-")[1])));

                    for (const tab of tabsToRemove) {
                        tab.remove();
                    }
                },
                `Collection(${collection.title}) observer`
            )
        });
        observables.set(collection.id, observable);
    }
    createObservable = funcPerformance(createObservable);

    async function showCollection(collection) {
        const collectionDiv = await getCollectionElement(collection);
        document.getElementById("collections").append(collectionDiv);
        createObservable(collection);
    }
    showCollection = funcPerformance(showCollection);

    const collectionsObservable = liveQuery(
        () => db.collections.toArray()
    );

    collectionsObservable.subscribe({
        next: funcPerformance(
            async (collections) => {
                observables.clear();
                const collectionsDiv = document.getElementById("collections");

                const pageCollections = [];
                const pageCollectionsIds = new Set();
                for (const collectionDiv of collectionsDiv.children) {
                    pageCollections.push(collectionDiv);
                    pageCollectionsIds.add(parseInt(collectionDiv.id.split("-")[1]));
                }

                const dbCollectionsIds = new Set(collections.map((collection) => collection.id));
                const collectionsToAddIds = dbCollectionsIds.difference(pageCollectionsIds);
                const collectionsToRemoveIds = pageCollectionsIds.difference(dbCollectionsIds);

                const collectionsToAdd = await Promise.all(collections.filter((collection) => collectionsToAddIds.has(collection.id)).map((collectionObject) => Collection.fromObject(collectionObject)));
                Promise.all(collectionsToAdd.map(async (collection) => {
                    collectionsDiv.append(await getCollectionElement(collection));
                    createObservable(collection);
                }));
                const collectionsToRemove = pageCollections.filter((collection) => collectionsToRemoveIds.has(parseInt(collection.id.split("-")[1])));

                for (const collection of collectionsToRemove) {
                    collection.remove();
                    observables.delete(collection.id);
                }
            },
            `collectionsObservable observer`)
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