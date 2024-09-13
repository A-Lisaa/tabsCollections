"use strict";

export function Uint8ArrayComparer(array1, array2) {
    if (array1.length !== array2.length)
        return false;
    for (let i = 0; i < array1.length; i++) {
        if (array1[i] !== array2[i])
            return false;
    }
    return true;
}

export function arrayBufferComparer(buffer1, buffer2) {
    return Uint8ArrayComparer(new Uint8Array(buffer1), new Uint8Array(buffer2));
}

export function createCallStack() {
    const stack = [];
    for (const line of (new Error()).stack.split("\n").slice(1, -2)) {
        let func = line.split("@")[0];
        if (func.startsWith("async*")) {
            func = func.split("*")[1];
            if (func === "")
                continue;
        }
        stack.push(func);
    }
    return stack;
}

export function isThenable(obj) {
    return typeof obj !== "undefined" && typeof obj !== "null" && obj["then"] !== undefined;
}

export async function resizeImage(image, width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    const img = new Image(width, height);
    img.src = image;
    await img.decode();
    context.drawImage(img, 0, 0, width, height);
    return canvas.convertToBlob();
}