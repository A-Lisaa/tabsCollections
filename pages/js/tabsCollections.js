"use strict";

import { liveQuery } from "../../modules/dexie.min.js";
import { Collection } from "../../scripts/Collection.js";
import { Favicons } from "../../scripts/Favicons.js";
import { db } from "../../scripts/globals.js";
import { funcPerformance } from "../../scripts/profiler.js";
import { Tab } from "../../scripts/Tab.js";

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
        return tabTemplate;
    }

    const tabTemplate = await getTabTemplate();
    const collectionElementTemplate = await getCollectionElementTemplate();

    // TODO: a function for collection create/edit modal

    async function setCollectionText(collectionElement, collectionSize) {
        // TODO: a good one for setting the collapser text
        const collapser = collectionElement.querySelector("button");
        collapser.textContent = `${collapser.textContent.split(" | ")[0]} | ${collectionSize} tab(s)`;
    }

    function getIdFromCollectionElement(element) {
        return parseInt(element.id.split("-")[1]);
    }

    async function setCollectionHeader(collection, { collectionHeader }) {
        const [collapseButton, deleteButton, editButton] = collectionHeader.children;

        // for the collapser
        collapseButton.setAttribute("data-bs-target", `#collection-${collection.id}-subelements`);
        collapseButton.setAttribute("aria-controls", `collection-${collection.id}-subelements`);
        collapseButton.textContent = `${collection.title} | ${collection.tabs.length} tab(s)`;

        new bootstrap.Popover(deleteButton);
        deleteButton.addEventListener("shown.bs.popover", async (event) => {
            const popover = document.getElementById(event.target.attributes["aria-describedby"].value);
            const [deleteButtonYes, deleteButtonNo] = popover.querySelectorAll("a");
            deleteButtonYes.addEventListener("click", async () => {
                Collection.delete(getIdFromCollectionElement(event.target.parentNode.parentNode));
                deleteButton.click();
            });
            deleteButtonNo.addEventListener("click", () => deleteButton.click());
        });

        editButton.addEventListener("click", async (event) => {
            const collectionElement = event.target.parentNode.parentNode;
            const collection = Collection.fromDB(getIdFromCollectionElement(collectionElement));
            document.getElementById("collectionModalTitle").value = collection.title;
            document.getElementById("collectionModalFilters").value = collection.filters.map((filter) => filter.original).join("\n");
            document.getElementById("collectionModalAllowDuplicates").value = collection.allowDuplicates;
            document.getElementById("collectionModalSaveButton").addEventListener("click", () => {
                const title = document.getElementById("collectionModalTitle").value.trim();
                const filters = document.getElementById("collectionModalFilters").value.trim().split("\n");
                const allowDuplicates = document.getElementById("collectionModalAllowDuplicates").checked;
                console.log({ id: collection.id, title: title, filters: filters, allowDuplicates: allowDuplicates });
                db.collections.put({ id: collection.id, title: title, filters: filters, allowDuplicates: allowDuplicates });
                collectionElement.querySelector("button").textContent = `${title} | ${collection.tabs.length} tab(s)`;
            });
        });
    }
    setCollectionHeader = funcPerformance(setCollectionHeader);

    function getIdFromTabElement(element) {
        return parseInt(element.id.split("-")[1]);
    }

    async function getTabElement(tab) {
        const row = tabTemplate.cloneNode(true);
        row.id = `tab-${tab.id}`;

        row.addEventListener("mouseenter", (event) => {
            event.target.querySelector("button").classList.remove("invisible");
        });
        row.addEventListener("mouseleave", (event) => {
            event.target.querySelector("button").classList.add("invisible");
        });

        const [closeButton, favicon, title, url, creationTime] = row.children;

        closeButton.firstElementChild.addEventListener("click", async (event) => Tab.delete(getIdFromTabElement(event.target.closest("tr"))));

        if (tab.favicon !== undefined) {
            if (typeof tab.favicon === "string") {
                // tab.favicon is a url to an image
                favicon.firstElementChild.src = tab.favicon;
            }
            else {
                // tab.favicon is a Blob with an image object
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
        // for the tooltip
        titleAnchor.setAttribute("data-bs-title", titleAnchor.textContent);
        new bootstrap.Tooltip(titleAnchor);

        const urlAnchor = url.firstElementChild;
        urlAnchor.href = tab.url;
        urlAnchor.textContent = decodeURI(tab.url);
        // for the tooltip
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

    const observables = new Map();

    async function createObservable(collection) {
        const observable = await collection.getObservable();
        observable.subscribe(funcPerformance(
                async (dbTabs) => {
                    const collectionElement = document.getElementById(`collection-${observable.collectionId}`);
                    setCollectionText(collectionElement, dbTabs.length);

                    const tbody = collectionElement.querySelector("tbody");

                    const pageTabs = [];
                    const pageTabsIds = new Set();
                    for (const tab of tbody.children) {
                        pageTabs.push(tab);
                        pageTabsIds.add(getIdFromTabElement(tab));
                    }

                    const dbTabsIds = new Set(dbTabs.map((tab) => tab.id));

                    // tabs which are already in the db but not on the page yet
                    const tabsToAddIds = dbTabsIds.difference(pageTabsIds);
                    // tabs which are still on the page but not in the db already
                    const tabsToRemoveIds = pageTabsIds.difference(dbTabsIds);

                    const favicons = await Favicons.getAll();
                    const tabsToAdd = await Promise.all(
                        dbTabs
                            .filter((tab) => tabsToAddIds.has(tab.id))
                            .map((tab) => Tab.fromObject(tab, favicons))
                    );
                    Promise.all(tabsToAdd.map(
                        async (tab) => {
                            tbody.append(await getTabElement(tab));
                        }
                    ));

                    const tabsToRemove = pageTabs.filter(
                        (tab) => tabsToRemoveIds.has(getIdFromTabElement(tab))
                    );
                    for (const tab of tabsToRemove)
                        tab.remove();
                },
                `Collection(${collection.title}) observer`
            )
        );
        observables.set(collection.id, observable);
    }

    const collectionsObservable = liveQuery(
        () => db.collections.toArray()
    );

    collectionsObservable.subscribe(funcPerformance(
        async (collections) => {
            observables.clear();
            const collectionsDiv = document.getElementById("collections");

            const pageCollections = [];
            const pageCollectionsIds = new Set();
            for (const collectionElement of collectionsDiv.children) {
                pageCollections.push(collectionElement);
                pageCollectionsIds.add(getIdFromCollectionElement(collectionElement));
            }

            const dbCollectionsIds = new Set(collections.map((collection) => collection.id));

            const collectionsToAddIds = dbCollectionsIds.difference(pageCollectionsIds);
            const collectionsToRemoveIds = pageCollectionsIds.difference(dbCollectionsIds);

            const collectionsToAdd = await Promise.all(
                collections
                    .filter((collection) => collectionsToAddIds.has(collection.id))
                    .map((collectionObject) => Collection.fromObject(collectionObject))
            );
            Promise.all(collectionsToAdd.map(async (collection) => {
                collectionsDiv.append(await getCollectionElement(collection));
                createObservable(collection);
            }));

            for (const collection of pageCollections) {
                const collectionId = getIdFromCollectionElement(collection);
                if (collectionsToRemoveIds.has(collectionId)) {
                    collection.remove();
                    observables.delete(collectionId);
                }
            }
        },
        `collectionsObservable observer`)
    );

    async function createCollection() {
        document.getElementById("collectionModalSaveButton").addEventListener("click", () => {
            const title = document.getElementById("collectionModalTitle").value.trim();
            const filters = document.getElementById("collectionModalFilters").value.trim().split("\n");
            const allowDuplicates = document.getElementById("collectionModalAllowDuplicates").checked;
            Collection.create(title, filters, allowDuplicates);
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