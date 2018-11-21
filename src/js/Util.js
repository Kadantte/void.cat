/**
 * @constant {function} - Helper function for document.querySelector
 * @param {string} selector - The selector to use in the query
 * @returns {HTMLElement} The first selected element
 */
const $ = (selector) => document.querySelector(selector);

const Log = {
    I: (msg) => console.log(`[App_v ${AppVersion}][I]: ${msg}`),
    W: (msg) => console.warn(`[App_v ${AppVersion}][W]: ${msg}`),
    E: (msg) => console.error(`[App_v ${AppVersion}][E]: ${msg}`)
};

/**
 * Make a HTTP request with promise
 * @param {string} method - HTTP method for this request
 * @param {string} url - Request URL
 * @param {[object]} data - Request payload (method must be post)
 * @returns {Promise<XMLHttpRequest>} The completed request
 */
const JsonXHR = async function (method, url, data) {
    return await XHR(method, url, JSON.stringify(data), {
        'Content-Type': 'application/json'
    });
};

/**
 * Make a HTTP request with promise
 * @param {string} method - HTTP method for this request
 * @param {string} url - Request URL
 * @param {[*]} data - Request payload (method must be post)
 * @param {[*]} headers - Headers to add to the request
 * @param {[function]} uploadprogress - Progress function from data uploads
 * @param {[function]} downloadprogress - Progress function for data downloads
 * @param {[function]} editrequest - Function that can edit the request before its sent
 * @returns {Promise<XMLHttpRequest>} The completed request
 */
const XHR = function (method, url, data, headers, uploadprogress, downloadprogress, editrequest) {
    return new Promise(function (resolve, reject) {
        let x = new XMLHttpRequest();
        x.onreadystatechange = function (ev) {
            if (ev.target.readyState === 4) {
                resolve(ev.target);
            }
        };

        if (typeof uploadprogress === "function") {
            x.upload.onprogress = uploadprogress;
        }

        if (typeof downloadprogress === "function") {
            x.onprogress = downloadprogress;
        }
        x.onerror = function (ev) {
            reject(ev);
        };
        x.open(method, url, true);

        if (typeof editrequest === "function") {
            editrequest(x);
        }
        //set headers if they are passed
        if (typeof headers === "object") {
            for (let h in headers) {
                x.setRequestHeader(h, headers[h]);
            }
        }
        if (method === "POST" && typeof data !== "undefined") {
            x.send(data);
        } else {
            x.send();
        }
    })
};

/**
 * Calls api handler
 */
const Api = {
    DoRequest: async function (req) {
        return JSON.parse((await JsonXHR('POST', '/api', req)).response);
    },

    GetFileInfo: async function (id) {
        return await Api.DoRequest({
            cmd: 'file_info',
            id: id
        });
    },

    CaptchaInfo: async function() {
        return await Api.DoRequest({
            cmd: 'captcha_info'
        });
    },

    VerifyCaptchaRateLimit: async function(id, token) {
        return await Api.DoRequest({
            cmd: 'verify_captcha_rate_limit',
            id: id,
            token: token
        });
    }
};

/**
 * Generic util functions
 */
const Utils = {
    /**
     * Formats an ArrayBuffer to hex
     * @param {ArrayBuffer} buffer - Input data to convert to hex
     * @returns {string} The encoded data as a hex string
     */
    ArrayToHex: (buffer) => Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join(''),

    /**
     * Converts hex to ArrayBuffer
     * @param {string} hex - The hex to parse into ArrayBuffer
     * @returns {ArrayBuffer} The parsed hex data
     */
    HexToArray: (hex) => {
        let ret = new Uint8Array(hex.length / 2)

        for (let i = 0; i < hex.length; i += 2) {
            ret[i / 2] = parseInt(hex.substring(i, i + 2), 16)
        }

        return ret.buffer
    },

    /**
     * Formats bytes into binary notation
     * @param {number} b - The value in bytes
     * @param {number} [f=2] - The number of decimal places to use
     * @returns {string} Bytes formatted in binary notation
     */
    FormatBytes: (b, f) => {
        f = typeof f === 'number' ? 2 : f;
        if (b >= YiB)
            return (b / YiB).toFixed(f) + ' YiB';
        if (b >= ZiB)
            return (b / ZiB).toFixed(f) + ' ZiB';
        if (b >= EiB)
            return (b / EiB).toFixed(f) + ' EiB';
        if (b >= PiB)
            return (b / PiB).toFixed(f) + ' PiB';
        if (b >= TiB)
            return (b / TiB).toFixed(f) + ' TiB';
        if (b >= GiB)
            return (b / GiB).toFixed(f) + ' GiB';
        if (b >= MiB)
            return (b / MiB).toFixed(f) + ' MiB';
        if (b >= kiB)
            return (b / kiB).toFixed(f) + ' KiB';
        return b.toFixed(f) + ' B'
    }
};