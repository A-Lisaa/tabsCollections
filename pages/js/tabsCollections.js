"use strict";

import { Collection } from "../../scripts/Collection.js";
import { openDB } from "../../scripts/db.js";
import { liveQuery } from "../../scripts/dexie.min.js";

(function() {
    const db = openDB();

    const collectionsObservable = liveQuery(
        () => db.collections.toArray()
    );

    collectionsObservable.subscribe({
        next: async (result) => {
            document.getElementById("collections").innerHTML = "";
            for (let collectionObject of result) {
                let collection = Collection.fromObject(collectionObject);
                let collectionDiv = await getCollectionElement(collection);
                document.getElementById("collections").append(collectionDiv);
            }
        }
    });

    async function getCollectionElement(collection) {
        let div = document.createElement("div");
        div.classList.add("mb-2");
        div.innerHTML = `
            <div class="d-flex">
                <button
                    class="btn btn-outline-secondary my-auto flex-fill"
                    style="text-align: left; border-radius: 0px;"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collection-${collection.title}-subelements"
                    aria-expanded="true"
                    aria-controls="collection-${collection.title}-subelements"
                >
                    ${collection.title} | ${collection.tabs.length} tabs
                </button>
            </div>
            <div id="collection-${collection.title}-subelements" class="collapse show my-1">
                <table class="table table-sm table-borderless">
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
                        ${collection.tabs.map((tab) => `
                            <tr class="collectionTRow">
                                <td>
                                    <button type="button" class="deleteTabBtn btn-close align-middle invisible"></button>
                                </td>
                                <td><img src="${tab.favicon ?? ''}" style="width: 16px; height: 16px;" /></td>
                                <td>${tab.title ?? 'No title'}</td>
                                <td>${tab.url}</td>
                                <td>${tab.creationTime.toLocaleString()}</td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
        for (let element of div.querySelectorAll(".collectionTRow")) {
            element.addEventListener("mouseenter", (event) => {
                event.target.querySelector(".deleteTabBtn").classList.remove("invisible");
            });
            element.addEventListener("mouseleave", (event) => {
                event.target.querySelector(".deleteTabBtn").classList.add("invisible");
            });
        }
        for (let element of div.querySelectorAll(".deleteTabBtn")) {
            element.addEventListener("click", async (event) => {
                let id = event.target.closest("div").id;
                let collectionTitle = id.slice(id.indexOf("-") + 1, id.lastIndexOf("-"));
                let index = event.target.closest("tr").rowIndex - 1;
                let collection = await Collection.load(collectionTitle);
                collection.tabs.splice(index, 1);
                collection.save();
            });
        }
        return div;
    }

    async function createCollection() {
        let collection = Collection.fromPrompt();
        collection.save();
        //updateCollections();
    }

    async function addHandlers() {
        document.getElementById("createCollection").addEventListener("click", createCollection);
    }

    async function main() {
        await showCollections();
        await addHandlers();
    }

    document.addEventListener("DOMContentLoaded", main);
})();