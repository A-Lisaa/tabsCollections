"use strict";

export class ArrayExtensions {
    static deleteValues(array, ...values) {
        for (const value of values) {
            const index = array.indexOf(value);
            if (index !== -1) {
                array.splice(index, 1);
            }
        }
        return array;
    }
}

export class MapExtensions {
    static getKeysByValue(map, lookupValue, comparer = (left, right) => left === right) {
        const keys = [];
        for (const [key, value] of map.entries()) {
            if (comparer(value, lookupValue))
                keys.push(key);
        }
        return keys;
    }
}