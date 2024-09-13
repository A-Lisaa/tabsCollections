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

    static getBiggestElements(array, comparer) {
        if (array.length === 0)
            return [];
        if (array.length === 1)
            return [array[0]];

        const result = [];

        let biggestValue;
        if (comparer(array[0], array[1]) < 0) {
            result.push(array[1]);
            biggestValue = array[1];
        }
        else if (comparer(array[0], array[1]) > 0) {
            result.push(array[0]);
            biggestValue = array[0];
        }
        else {
            result.push(array[0], array[1]);
            biggestValue = array[0];
        }

        for (const i = 2; i < array.length; i++) {
            if (comparer(biggestValue, array[i]) < 0) {
                result.length = 0;
                result.push(array[i]);
                biggestValue = array[i];
            }
            else if (comparer(biggestValue, array[i]) === 0) {
                result.push(array[i]);
            }
        }
        return result;
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

export class RandomExtensions {
    static randint(min, max) {
        // min and max included
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
}