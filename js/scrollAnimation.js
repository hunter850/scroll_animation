// 參考vue nextTick
var nextTick = (fn) => {
    return fn ? Promise.resolve().then(this ? fn.bind(this) : fn) : Promise.resolve();
}

var timeout = (callback, tick) => {
    let start;
    let animationFlag;
    (function step(timestamp) {
        if (!start) {
            start = timestamp;
            animationFlag = window.requestAnimationFrame(step);
            return;
        }
        const progress = timestamp - start;
        if (progress < tick) {
            animationFlag = window.requestAnimationFrame(step);
            return;
        }
        callback();
    })();
    return () => {
        cancelAnimationFrame(animationFlag);
    };
};

var throttle = (callback, tick) => {
    let canRun = true;
    let callAgainNexTick = false;
    return function () {
        if (canRun) {
            canRun = false;
            callback();
            (function loop() {
                timeout(() => {
                    if (callAgainNexTick) {
                        callback();
                        callAgainNexTick = false;
                        loop();
                    } else {
                        canRun = true;
                    }
                }, tick);
            })();
        } else {
            callAgainNexTick = true;
        }
    };
};

// ------------------------------------------------

// stackoverflow answer
// var isElement = (o) => {
//     return (
//         typeof HTMLElement === "object"
//             ? o instanceof HTMLElement
//             : o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string"
//     );
// }

// lodash isElement
const toString = Object.prototype.toString
var isObjectLike = (value) => {
    return typeof value === "object" && value !== null
};
var getTag = (value) => {
    if (value == null) {
        return value === undefined ? "[object Undefined]" : "[object Null]"
    }
    return toString.call(value)
};
var isPlainObject = (value) => {
    if (!isObjectLike(value) || getTag(value) != "[object Object]") {
        return false
    }
    if (Object.getPrototypeOf(value) === null) {
        return true
    }
    let proto = value
    while (Object.getPrototypeOf(proto) !== null) {
        proto = Object.getPrototypeOf(proto)
    }
    return Object.getPrototypeOf(value) === proto
};
var isElement = (value) => {
    return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value)
};

// ------------------------------------------------

var cumulativeOffset = (node) => {
    const output = {
        top: 0,
        left: 0,
    };
    do {
        output.top += node.offsetTop || 0;
        output.left += node.offsetLeft || 0;
        node = node.offsetParent;
    } while (node);

    return output;
};

var isEnter = (node, offsetStart = 0, mode = "DOMPosition") => {
    if (mode === "renderPosition") {
        if (node.getBoundingClientRect().top - window.innerHeight + offsetStart <= 0) {
            return true;
        } else {
            return false;
        }
    } else {
        if (window.pageYOffset >= cumulativeOffset(node).top + offsetStart - window.innerHeight) {
            return true;
        } else {
            return false;
        }
    }
};

var isInWindow = (node, offsetStart = 0, offsetEnd = 0, mode = "DOMPosition") => {
    if (mode === "renderPosition") {
        if (node.getBoundingClientRect().top - window.innerHeight + offsetStart <= 0 &&
            node.getBoundingClientRect().bottom + offsetEnd >= 0) {
            return true;
        } else {
            return false;
        }
    } else {
        if (window.pageYOffset >= cumulativeOffset(node).top + offsetStart - window.innerHeight &&
            window.pageYOffset <= node.getBoundingClientRect().height + cumulativeOffset(node).top + offsetEnd) {
            return true;
        } else {
            return false;
        }
    }
};

var shouldEnter = (node, from = "", to = "", offsetStart = 0, delay = 0, mode = "DOMposition", throttleTime = 100) => {
    if (typeof from === "string" && from !== "") {
        node.classList.add(from);
    }
    let start = offsetStart;
    if (typeof offsetStart === "function") {
        start = offsetStart(node);
    }
    const output = {
        isIn: isEnter(node, start, mode),
        isRun: false,
    }
    function doEnter() {
        node.classList.add(to);
        nextTick(() => {
            node.classList.remove(from);
            function transitionHandler() {
                node.classList.remove(from);
                node.classList.remove(to);
                node.removeEventListener("transitionend", transitionHandler);
            }
            node.addEventListener("transitionend", transitionHandler);
        });
    }
    function doEnterWhileNoFrom() {
        node.classList.add(to);
        function transitionHandler() {
            node.classList.remove(to);
            node.removeEventListener("transitioned", transitionHandler);
        }
        node.addEventListener("transitioned", transitionHandler);
    }
    function doExit() {
        if (typeof from === "string" && from !== "") {
            node.classList.add(from);
            nextTick(() => {
                node.classList.remove(to);
            });
        } else {
            node.classList.remove(to);
        }
    }
    const proxyOutput = new Proxy(output, {
        set: function (target, key, value) {
            if (key === "" || key === undefined || key === null) {
                return false;
            }
            if (key === "isIn" && value === false) {
                doExit();
            }
            if (target[key] !== undefined && target[key] === value) {
                return false;
            }
            if (key === "isRun" || key === "stop") {
                return false;
            }
            // console.log(`${key} set to ${value}`)
            target[key] = value;
            if (proxyOutput.isIn) {
                // 進場
                if (typeof from === "string" && from !== "") {
                    if (delay === 0) {
                        doEnter();
                    } else {
                        timeout(() => {
                            doEnter();
                        }, delay);
                    }
                } else {
                    doEnterWhileNoFrom();
                }
            } else {
                // 退場
                doExit();
            }
            return true;
        }
    });
    function scrollHandler() {
        // 若已進場 又向上捲 移出視窗外 則退場
        if (!isEnter(node, 0, mode)) {
            proxyOutput.isIn = false;
            return;
        }
        // 若未進場 則根據offset判斷DOM是否在視窗內決定是否進場
        if (isEnter(node, start, mode)) {
            proxyOutput.isIn = true;
            return;
        }
        // 其餘狀況不改變狀態
        return;

    }
    // 第一次執行
    if (!proxyOutput.isRun) {
        if (proxyOutput.isIn) {
            if (typeof from === "string" && from !== "") {
                if (delay === 0) {
                    doEnter();
                } else {
                    timeout(() => {
                        doEnter();
                    }, delay);
                }
            } else {
                doEnterWhileNoFrom();
            }
        }
        const throttleFunction = throttleTime === "none" ? scrollHandler : throttle(scrollHandler, throttleTime)
        window.addEventListener("scroll", throttleFunction);
        window.addEventListener("resize", throttleFunction);
        proxyOutput.stop = () => {
            window.removeEventListener("scroll", throttleFunction);
            window.removeEventListener("resize", throttleFunction);
        }
        proxyOutput.isRun = true;
    }
    return proxyOutput;
};

var shouldEnterBothSides = (node, from = "", to = "", offsetStart = 0, offsetEnd = 0, delay = 0, mode = "DOMposition", throttleTime = 100) => {
    if (typeof from === "string" && from !== "") {
        node.classList.add(from);
    }
    let start = offsetStart;
    let end = offsetEnd;
    if (typeof offsetStart === "function") {
        start = offsetStart(node);
    }
    if (typeof offsetEnd === "function") {
        end = offsetEnd(node);
    }
    const output = {
        isIn: isInWindow(node, start, end, mode),
        isRun: false,
    }
    function doEnter() {
        node.classList.add(to);
        nextTick(() => {
            node.classList.remove(from);
            function transitionHandler() {
                node.classList.remove(from);
                node.classList.remove(to);
                node.removeEventListener("transitionend", transitionHandler);
            }
            node.addEventListener("transitionend", transitionHandler);
        });
    }
    function doEnterWhileNoFrom() {
        node.classList.add(to);
        function transitionHandler() {
            node.classList.remove(to);
            node.removeEventListener("transitioned", transitionHandler);
        }
        node.addEventListener("transitioned", transitionHandler);
    }
    function doExit() {
        if (typeof from === "string" && from !== "") {
            node.classList.add(from);
            nextTick(() => {
                node.classList.remove(to);
            });
        } else {
            node.classList.remove(to);
        }
    }
    const proxyOutput = new Proxy(output, {
        set: function (target, key, value) {
            if (key === "" || key === undefined || key === null) {
                return false;
            }
            if (key === "isIn" && value === false) {
                doExit();
            }
            if (target[key] !== undefined && target[key] === value) {
                return false;
            }
            if (key === "isRun" || key === "stop") {
                return false;
            }
            // console.log(`${key} set to ${value}`)
            target[key] = value;
            if (proxyOutput.isIn) {
                // 進場
                if (typeof from === "string" && from !== "") {
                    if (delay === 0) {
                        doEnter();
                    } else {
                        timeout(() => {
                            doEnter();
                        }, delay);
                    }
                } else {
                    doEnterWhileNoFrom();
                }
            } else {
                // 退場
                doExit();
            }
            return true;
        }
    });
    function scrollHandler() {
        // 若已進場 又移出視窗外 則退場
        if (!isInWindow(node, 0, 0, mode)) {
            proxyOutput.isIn = false;
            return;
        }
        // 若未進場 則根據offset判斷DOM是否在視窗內決定是否進場
        if (isInWindow(node, start, end, mode)) {
            proxyOutput.isIn = true;
            return;
        }
        // 其餘狀況不改變狀態
        return;
    }
    // 初始
    if (!proxyOutput.isRun) {
        if (proxyOutput.isIn) {
            if (typeof from === "string" && from !== "") {
                if (delay === 0) {
                    doEnter();
                } else {
                    timeout(() => {
                        doEnter();
                    }, delay);
                }
            } else {
                doEnterWhileNoFrom();
            }
        }
        const throttleFunction = throttleTime === "none" ? scrollHandler : throttle(scrollHandler, throttleTime)
        window.addEventListener("scroll", throttleFunction);
        window.addEventListener("resize", throttleFunction);
        proxyOutput.stop = () => {
            window.removeEventListener("scroll", throttleFunction);
            window.removeEventListener("resize", throttleFunction);
        }
        proxyOutput.isRun = true;
    }
    return proxyOutput;
};

// -------------------------------------------------------------------------------

var sa = (node, obj) => {
    // js
    if (node === undefined) return;
    const { start = "", end, offset = 0, backAgain = false, backOffset = 0, delay = 0, mode = "DOMPosition", throttle: throttleTime = 100 } = obj;
    if (typeof end !== "string" && end === "") {
        return;
    }
    if (typeof start !== "string") {
        return;
    }
    if (isElement(node)) {
        if (backAgain) {
            shouldEnterBothSides(node, start, end, offset, backOffset, delay, mode, throttleTime);
        } else {
            shouldEnter(node, start, end, offset, delay, mode, throttleTime);
        }
    } else if (typeof node !== "string" && typeof node.length === "number" && node.length >= 1) {
        const nodeArray = [...node];
        const elements = nodeArray.filter(el => el.dataset === undefined || el.dataset.sa === undefined);
        elements.forEach(item => {
            if (isElement(item)) {
                if (backAgain) {
                    shouldEnterBothSides(item, start, end, offset, backOffset, delay, mode, throttleTime);
                } else {
                    shouldEnter(item, start, end, offset, delay, mode, throttleTime);
                }
            }
        })
    } else if (typeof node === "string") {
        try {
            const el = [...document.querySelectorAll(node)];
            el.filter(item => item.dataset === undefined || item.dataset.sa === undefined);
            if (typeof el.length === "number" && el.length >= 1) {
                el.forEach(item => {
                    if (backAgain) {
                        shouldEnterBothSides(item, start, end, offset, backOffset, delay, mode, throttleTime);
                    } else {
                        shouldEnter(item, start, end, offset, delay, mode, throttleTime);
                    }
                })
            }
        } catch (error) {
            throw new Error("invalid DOM selector");
        }
    } else {
        return;
    }
};

// inline data-sa
(() => {
    const elements = document.querySelectorAll("[data-sa]");
    if (elements.length >= 1) {
        elements.forEach(el => {
            let { start = "", end, offset = "0", backAgain = "false", backOffset = "0", delay = "0", mode = "DOMPosition", throttle = "100" } = el.dataset;
            if (end) {
                offset = Number.isNaN(parseFloat(offset)) ? 0 : parseFloat(offset);
                backAgain = backAgain === "true" ? true : false;
                backOffset = Number.isNaN(parseFloat(backOffset)) ? 0 : parseFloat(backOffset);
                delay = Number.isNaN(parseFloat(delay)) ? 0 : parseFloat(delay);
                const throttleTime = Number.isNaN(parseFloat(throttle)) ? 100 : parseFloat(throttle);

                if (backAgain) {
                    shouldEnterBothSides(el, start, end, offset, backOffset, delay, mode, throttleTime);
                } else {
                    shouldEnter(el, start, end, offset, delay, mode, throttleTime);
                }
            }
            return;
        })
    }
    return;
})();