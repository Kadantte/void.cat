import { Util, Log, Api } from './modules/Util.js';
import { ViewManager } from './modules/ViewManager.js';
import { FileDownloader } from './modules/FileDownloader.js';

const VoidFetch = function (event) {
    let vm = new ViewManager();
    let url = new URL(event.request.url);
    let path = url.pathname;

    let hs = vm.ParseFrag(path.substr(1));
    if (hs !== null) {
        Log.I(`Worker taking request: ${hs.id}`);

        event.respondWith(async function () {
            const client = await clients.get(event.clientId);

            let fi = await Api.GetFileInfo(hs.id);
            if (fi.ok) {
                let fd = new FileDownloader(fi.data, hs.key, hs.iv);
                fd.onprogress = function (x) {
                    if (client !== null && client !== undefined) {
                        client.postMessage({
                            type: 'progress',
                            x
                        });
                    }
                };
                let resp = await fd.StreamResponse();
                let head = await fd.waitForHeader;
                resp.headers.set("Content-Type", head.mime != "" ? head.mime : "application/octet-stream");
                resp.headers.set("Content-Disposition", `inline; filename="${head.name}"`);
                return resp;
            } else {
                return Response.error();
            }
        }());
    }
}

self.addEventListener('fetch', VoidFetch);