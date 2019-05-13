import * as Const from './Const.js';
import { Templates } from './App.js';
import { XHR, Utils, Log, $ } from './Util.js';
import { VBF } from './VBF.js';
import { bytes_to_base64, HmacSha256, AES_CBC } from 'asmcrypto.js';

/**
 * File upload handler class
 * @class
 * @param {File} file - The file handle to upload
 * @param {string} host - The hostname to upload to
 */
function FileUpload(file, host) {
    this.hasCrypto = typeof window.crypto.subtle === "object";
    this.file = file;
    this.host = host;
    this.domNode = null;
    this.key = new Uint8Array(16);
    this.iv = new Uint8Array(16);

    /**
     * Track uplaod stats
     */
    this.uploadStats = {
        lastRate: 0,
        lastLoaded: 0,
        lastProgress: 0
    };

    /**
     * Get the encryption key as hex
     * @returns {Promise<string>} The encryption get in hex
     */
    this.HexKey = async () => {
        return Utils.ArrayToHex(await crypto.subtle.exportKey('raw', this.key));
    };

    /**
     * Get the IV as hex
     * @returns {string} The IV for envryption has hex
     */
    this.HexIV = () => {
        return Utils.ArrayToHex(this.iv);
    };

    /**
     * Returns the formatted key and iv as hex
     * @returns {Promise<string>} The key:iv as hex
     */
    this.TextKey = async () => {
        return `${await this.HexKey()}:${this.HexIV()}`;
    };

    /**
     * Retruns the formatted hash fragment for this upload
     * @param {string} id - The id returned from upload result
     * @returns {Promise<string>} The id:key:iv concatenated and converted to base64
     */
    this.FormatUrl = async (id) => {
        let id_hex = new Uint8Array(Utils.HexToArray(id));
        let key = new Uint8Array(await crypto.subtle.exportKey('raw', this.key));
        let iv = new Uint8Array(this.iv);

        let ret = new Uint8Array(id_hex.byteLength + key.byteLength + iv.byteLength);
        ret.set(id_hex, 0);
        ret.set(key, id_hex.byteLength);
        ret.set(iv, id_hex.byteLength + key.byteLength);

        return bytes_to_base64(ret);
    };

    /**
     * Retruns the formatted hash fragment for this upload
     * @param {string} id - The id returned from upload result
     * @returns {Promise<string>} The id:key:iv concatenated and converted to base64
     */
    this.FormatRawUrl = async (id) => {
        let id_hex = new Uint8Array(Utils.HexToArray(id));

        let ret = new Uint8Array(id_hex.byteLength + this.key.byteLength + this.iv.byteLength);
        ret.set(id_hex, 0);
        ret.set(this.key, id_hex.byteLength);
        ret.set(this.iv, id_hex.byteLength + this.key.byteLength);

        return bytes_to_base64(ret);
    };

    /**
     * Loads the file and SHA256 hashes it
     * @return {Promise<ArrayBuffer>}
     */
    this.HashFile = async () => {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();

            fr.onloadstart = function (ev) {
                this.HandleProgress('state-load-start');
            }.bind(this);

            fr.onloadend = function (ev) {
                this.HandleProgress('state-load-end');
            }.bind(this);

            fr.onload = function (ev) {
                this.HandleProgress('state-hash-start');
                crypto.subtle.sign(Const.HMACKeyDetails, this.hmackey, ev.target.result).then(function (hash) {
                    this.HandleProgress('state-hash-end');
                    resolve({
                        hash: hash,
                        data: ev.target.result
                    });
                }.bind(this));
            }.bind(this);

            fr.onprogress = function (ev) {
                this.HandleProgress('progress', ev.loaded / parseFloat(ev.total));
            }.bind(this);

            fr.onerror = function (ev) {
                this.HandleError({
                    type: 'FileReaderError',
                    error: ev.target.error
                })
            }.bind(this);

            fr.readAsArrayBuffer(this.file);
        }.bind(this));
    };

    /**
     * Sets the width of the progress bar for this upload
     * @param {number} value - The value of the progress
     */
    this.SetProgressBar = function (value) {
        this.domNode.progress.textContent = `${(100 * value).toFixed(1)}%`;
        this.domNode.progressBar.style.width = `${(100 * value)}%`;
    };

    /**
     * Sets the status label for this upload
     * @param {string} value - The status label
     */
    this.SetStatus = function (value) {
        this.domNode.state.textContent = `Status: ${value}`;
    };

    /**
     * Sets the speed value on the UI
     */
    this.SetSpeed = function (value) {
        this.domNode.filespeed.textContent = value;
    };

    /**
     * Handles progress messages from the upload process and updates the UI
     * @param {string} type - The progress event type
     * @param {number} progress - The percentage of this progress type
     */
    this.HandleProgress = function (type, progress) {
        switch (type) {
            case 'state-load-start': {
                this.SetStatus('Loading file..');
                this.SetProgressBar(0);
                break;
            }
            case 'state-load-end': {
                this.SetProgressBar(1);
                break;
            }
            case 'state-hash-start': {
                this.SetStatus('Hashing..');
                this.SetProgressBar(0);
                break;
            }
            case 'state-hash-end': {
                this.SetProgressBar(1);
                break;
            }
            case 'state-pre-check-start': {
                this.SetStatus('Checking file info..');
                this.SetProgressBar(0);
                break;
            }
            case 'state-pre-check-end': {
                this.SetProgressBar(1);
                break;
            }
            case 'state-encrypt-start': {
                this.SetStatus('Encrypting..');
                this.SetProgressBar(0);
                break;
            }
            case 'state-encrypt-end': {
                this.SetProgressBar(1);
                break;
            }
            case 'state-upload-start': {
                this.SetStatus('Uploading..');
                this.SetProgressBar(0);
                break;
            }
            case 'state-upload-end': {
                this.SetProgressBar(1);
                this.SetSpeed("Done");
                break;
            }
            case 'progress': {
                this.SetProgressBar(progress < 0.01 ? 0.01 : progress);
                break;
            }
        }
    };

    /**
     * Handles upload errors to display on the UI
     */
    this.HandleError = function (err) {
        Log.E(err.error);
        switch (err.type) {
            case 'FileReaderError': {
                this.SetProgressBar('1px');
                break;
            }
        }
    };

    /**
     * Creates a template for the upload to show progress
     */
    this.CreateNode = function () {
        let nelm = document.importNode(Templates.Upload.content, true);

        nelm.filename = nelm.querySelector('.file-info .file-info-name');
        nelm.filesize = nelm.querySelector('.file-info .file-info-size');
        nelm.filespeed = nelm.querySelector('.file-info .file-info-speed');
        nelm.progress = nelm.querySelector('.upload-progress span');
        nelm.progressBar = nelm.querySelector('.upload-progress div');
        nelm.state = nelm.querySelector('.status .status-state');
        nelm.key = nelm.querySelector('.status .status-key');
        nelm.links = nelm.querySelector('.links');
        nelm.errors = nelm.querySelector('.errors');

        nelm.filename.textContent = this.file.name;
        nelm.filesize.textContent = Utils.FormatBytes(this.file.size, 2);
        this.domNode = nelm;

        $('#uploads').appendChild(nelm);
    };

    /**
     * Generates a new key to use for encrypting the file
     * @returns {Uint8Array} The new key
     */
    this.GenerateRawKey = function () {
        crypto.getRandomValues(this.key);
        crypto.getRandomValues(this.iv);

        this.domNode.key.textContent = `Key: ${this.TextKey()}`;
        return this.key;
    };

    /**
     * Generates a new key to use for encrypting the file
     * @returns {Promise<CryptoKey>} The new key
     */
    this.GenerateKey = async function () {
        this.key = await crypto.subtle.generateKey(Const.EncryptionKeyDetails, true, ['encrypt', 'decrypt']);
        this.hmackey = await crypto.subtle.importKey("raw", await crypto.subtle.exportKey('raw', this.key), Const.HMACKeyDetails, false, ["sign"]);

        crypto.getRandomValues(this.iv);

        this.domNode.key.textContent = `Key: ${await this.TextKey()}`;
        return this.key;
    };

    /**
     * Encrypts the file using the key and iv
     * @param {BufferSource} fileData - The data to encrypt
     * @returns {Promise<ArrayBuffer>} - The Encrypted data
     */
    this.EncryptFile = async function (fileData) {
        this.HandleProgress('state-encrypt-start');
        let encryptedData = await crypto.subtle.encrypt({
            name: Const.EncryptionAlgo,
            iv: this.iv
        }, this.key, fileData);
        this.HandleProgress('state-encrypt-end');
        return encryptedData;
    };

    /**
     * Uploads Blob data to site
     * @param {ReadableStream} fileData - The encrypted file data to upload
     * @returns {Promise<object>} The json result
     */
    this.UploadDataStream = async function (fileData) {
        this.uploadStats.lastProgress = new Date().getTime();
        this.HandleProgress('state-upload-start');

        let request = new Request(`${window.location.protocol}//${this.host}/upload`, {
            method: "POST",
            body: fileData,
            headers: { "Content-Type": "application/octet-stream" }
        })
        let response = await fetch(request);
        return await response.json();
    };

    /**
     * Uploads Blob data to site
     * @param {Blob|BufferSource} fileData - The encrypted file data to upload
     * @returns {Promise<object>} The json result
     */
    this.UploadData = async function (fileData) {
        this.uploadStats.lastProgress = new Date().getTime();
        this.HandleProgress('state-upload-start');
        
        let uploadResult = await XHR("POST", `${window.location.protocol}//${this.host}/upload`, fileData, { "Content-Type": "application/octet-stream" }, function (ev) {
            let now = new Date().getTime();
            let dxLoaded = ev.loaded - this.uploadStats.lastLoaded;
            let dxTime = now - this.uploadStats.lastProgress;

            this.uploadStats.lastLoaded = ev.loaded;
            this.uploadStats.lastProgress = now;

            this.SetSpeed(`${Utils.FormatBytes(dxLoaded / (dxTime / 1000.0), 2)}/s`);
            this.HandleProgress('progress', ev.loaded / parseFloat(ev.total));
        }.bind(this));

        this.HandleProgress('state-upload-end');
        return JSON.parse(uploadResult.response);
    };

    /**
     * Creates a header object to be prepended to the file for encrypting
     * @returns {any}
     */
    this.CreateHeader = function () {
        return {
            name: this.file.name,
            mime: this.file.type,
            len: this.file.size
        };
    };

    /**
     * Processes the file upload
     * @return {Promise}
     */
    this.ProcessUpload = async function () {
        Log.I(`Starting upload for ${this.file.name}`);
        this.CreateNode();

        await this.GenerateKey();
        let header = JSON.stringify(this.CreateHeader());
        let hash_data = await this.HashFile();
        let h256 = Utils.ArrayToHex(hash_data.hash);
        Log.I(`${this.file.name} hash is: ${h256}`);

        //create blob for encryption
        let header_data = new TextEncoder('utf-8').encode(header);
        Log.I(`Using header: ${header} (length=${header_data.byteLength})`);

        let encryption_payload = new Uint8Array(2 + header_data.byteLength + hash_data.data.byteLength);
        let header_length_data = new Uint16Array(1);
        header_length_data[0] = header_data.byteLength; //header length
        encryption_payload.set(header_length_data, 0);
        encryption_payload.set(new Uint8Array(header_data), 2); //the file info header
        encryption_payload.set(new Uint8Array(hash_data.data), 2 + header_data.byteLength);

        //encrypt with the key
        Log.I(`Encrypting ${this.file.name} with key ${await this.HexKey()} and IV ${this.HexIV()}`)
        let encryptedData = await this.EncryptFile(encryption_payload);

        Log.I(`Uploading file ${this.file.name}`);
        let upload_payload = VBF.Create(hash_data.hash, encryptedData);
        let uploadResult = await this.UploadData(upload_payload);

        Log.I(`Got response for file ${this.file.name}: ${JSON.stringify(uploadResult)}`);
        this.domNode.state.parentNode.style.display = "none";
        this.domNode.progress.parentNode.style.display = "none";

        if (uploadResult.status === 200) {
            this.domNode.links.style.display = "";

            let nl = document.createElement("a");
            nl.target = "_blank";
            nl.href = `${window.location.protocol}//${window.location.host}/#${await this.FormatUrl(uploadResult.id)}`;
            nl.textContent = this.file.name;
            this.domNode.links.appendChild(nl);
        } else {
            this.domNode.errors.style.display = "";
            this.domNode.errors.textContent = uploadResult.msg;
        }
    };

    /**
     * Stream the file upload
     * @return {Promise}
     */
    this.StreamUpload = async function () {
        Log.I(`Starting upload for ${this.file.name}`);
        this.CreateNode();

        this.GenerateRawKey();
        let header = JSON.stringify(this.CreateHeader());

        let vbf_stream = {
            type: "bytes",
            autoAllocateChunkSize: 16 * 1024,
            start(controller) {
                this.self.HandleProgress('state-load-start');
                this.offset = 0;
                this.chunkSize = 16 * 1024;
                this.aes = new AES_CBC(this.self.key, this.self.iv, true);
                this.hmac = new HmacSha256(this.self.key);

                //encode the header to bytes for encryption
                this.header_data = new TextEncoder('utf-8').encode(this.header);
                Log.I(`Using header: ${this.header} (length=${this.header_data.byteLength})`);
            },
            pull(controller) {
                let read_now = this.chunkSize;
                if(this.offset === 0) {
                    controller.enqueue(VBF.CreateV2Start());
                    read_now -= this.header_data.byteLength;
                } else if(this.offset === this.self.file.size) {
                    //done, send last encrypted part and hmac
                    controller.enqueue(this.self.aes.AES_Encrypt_finish());
                    this.self.hmac.finish();
                    controller.enqueue(this.self.hmac.hash);
                    controller.close();
                }

                //read file slice
                return new Promise((resolve, reject) => {
                    let file_to_read = this.self.file.slice(this.offset, this.offset + read_now);
                    let fr = new FileReader();
                    fr.onload = function(ev) {
                        let buf = null;
                        if(ev.target.self.offset === 0){
                            buf = new Uint8Array(ev.target.self.header_data.byteLength + ev.target.result.byteLength);
                            buf.set(ev.target.self.header_data, 0);
                            buf.set(ev.target.result, ev.target.self.header_data.byteLength);
                        } else {
                            buf = ev.target.result;
                        }

                        //hash the buffer
                        ev.target.self.hmac.process(buf);

                        //encrypt the buffer
                        controller.enqueue(ev.target.self.aes.AES_Encrypt_process(buf));

                        ev.target.self.offset += buf.byteLength;
                        resolve();
                    }
                    fr.onerror = function(ev) { reject(); }

                    fr.self = this;
                    fr.readAsArrayBuffer(file_to_read);
                });
            },
            cancel() {

            },
            self: this,
            header
        };

        let file_stream = new ReadableStream(vbf_stream);

        Log.I(`Uploading file ${this.file.name}`);
        let uploadResult = await this.UploadData(file_stream);

        Log.I(`Got response for file ${this.file.name}: ${JSON.stringify(uploadResult)}`);
        this.domNode.state.parentNode.style.display = "none";
        this.domNode.progress.parentNode.style.display = "none";

        if (uploadResult.status === 200) {
            this.domNode.links.style.display = "";

            let nl = document.createElement("a");
            nl.target = "_blank";
            nl.href = `${window.location.protocol}//${window.location.host}/#${await this.FormatRawUrl(uploadResult.id)}`;
            nl.textContent = this.file.name;
            this.domNode.links.appendChild(nl);
        } else {
            this.domNode.errors.style.display = "";
            this.domNode.errors.textContent = uploadResult.msg;
        }
    };
};

export { FileUpload };