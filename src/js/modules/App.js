import { Api, Utils, Log, $ } from './Util.js';
import { ViewManager } from './ViewManager.js';
import { DropzoneManager } from './DropzoneManager.js';
import { FileUpload } from './FileUpload.js';

let ChartJsLoaded = false;

const Elements = {
    get Dropzone() { return $('#dropzone') },
    get Uploads() { return $('#uploads') },
    get PageView() { return $('#page-view') },
    get PageUpload() { return $('#page-upload') },
    get PageFaq() { return $('#page-faq') },
    get PageStats() { return $('#page-stats') },
    get PageDonate() { return $('#page-donate') }
};

const Templates = {
    get Upload() { return $("template[id='tmpl-upload']") }
};

const Browser = {
    get IsEdge() {
        return /Edge/.test(navigator.userAgent);
    },

    get IsChrome() {
        return !Browser.IsEdge && /^Mozilla.*Chrome/.test(navigator.userAgent);
    },

    get IsFirefox() {
        return !Browser.IsEdge && /^Mozilla.*Firefox/.test(navigator.userAgent);
    }
};

/**
 * Uploads the files as selected by the input form
 * @param {Element} ctx 
 * @returns {Promise}
 */
async function UploadFiles(ctx) {
    let files = ctx.files;
    let proc_files = [];

    for (let x = 0; x < files.length; x++) {
        let fu = new FileUpload(files[x]);
        proc_files[proc_files.length] = fu.ProcessUpload();
    }

    await Promise.all(proc_files);
}

function ResetView() {
    Elements.PageView.style.display = "none";
    Elements.PageUpload.style.display = "none";
    Elements.PageFaq.style.display = "none";
    Elements.PageStats.style.display = "none";
    Elements.PageDonate.style.display = "none";
}

async function ShowStats() {
    location.hash = "#stats";
    ResetView();

    if (!ChartJsLoaded) {
        await InsertScript("//cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js", () => {
            return typeof moment !== "undefined";
        });
        await InsertScript("//cdnjs.cloudflare.com/ajax/libs/Chart.js/2.7.3/Chart.min.js", () => {
            return typeof Chart !== "undefined";
        });
    }

    let api_rsp = await Api.GetTxChart();
    if (api_rsp.ok) {
        let ctx = $('#weektxgraph').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: api_rsp.data,
            options: {
                scales: {
                    xAxes: [{
                        type: 'time',
                        time: {
                            source: 'data'
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                            callback: function(label, index, labels) {
                                return Utils.FormatBytes(label);
                            }
                        }
                    }]
                }
            }
        });
    }
    Elements.PageStats.style.display = "block";
}

function ShowFAQ() {
    location.hash = "#faq";
    ResetView();
    Elements.PageFaq.style.display = "block";
}

function ShowDonate() {
    location.hash = "#donate";
    ResetView();
    Elements.PageDonate.style.display = "block";
}

/**
 * Sets up the page
 */
async function Init() {
    CheckBrowserSupport();
    MakePolyfills();

    ResetView();

    if (location.hash !== "") {
        if (location.hash == "#faq") {
            ShowFAQ();
        } else if (location.hash == "#stats") {
            ShowStats();
        } else if (location.hash == "#donate") {
            ShowDonate();
        } else {
            Elements.PageView.style.display = "block";
            let vm = new ViewManager();
            vm.LoadView();
        }
        window.site_info = await Api.GetSiteInfo();
    } else {
        window.site_info = await Api.GetSiteInfo();
        Elements.PageUpload.style.display = "block";
        $('#dropzone').innerHTML = `Click me!<br><small>(${Utils.FormatBytes(window.site_info.data.max_upload_size)} max)</small>`;
        new DropzoneManager(Elements.Dropzone);
    }

    if (window.site_info.ok) {
        let elms = document.querySelectorAll("#footer-stats div span");
        elms[0].textContent = window.site_info.data.basic_stats.Files;
        elms[1].textContent = Utils.FormatBytes(window.site_info.data.basic_stats.Size, 2);
        elms[2].textContent = Utils.FormatBytes(window.site_info.data.basic_stats.Transfer_24h, 2);
    }

    let faq_headers = document.querySelectorAll('#page-faq .faq-header');
    for (let x = 0; x < faq_headers.length; x++) {
        faq_headers[x].addEventListener('click', function () {
            this.nextElementSibling.classList.toggle("show");
        }.bind(faq_headers[x]));
    }
}

/**
 * Adds in polyfills for this browser
 */
function MakePolyfills() {
    if (typeof TextEncoder === "undefined" || typeof TextDecoder === "undefined") {
        InsertScript("//unpkg.com/text-encoding@0.6.4/lib/encoding-indexes.js");
        InsertScript("//unpkg.com/text-encoding@0.6.4/lib/encoding.js");
    }
}

/**
 * Adds a script tag at the top of the header
 * @param {string} src - The script src url
 * @param {function} fnWait - Function to use in promise to test if the script is loaded
 */
async function InsertScript(src, fnWait) {
    var before = document.head.getElementsByTagName('script')[0];
    var newlink = document.createElement('script');
    newlink.src = src;
    document.head.insertBefore(newlink, before);

    if (typeof fnWait === "function") {
        await new Promise((resolve, reject) => {
            let timer = setInterval(() => {
                if (fnWait()) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    }
}

/**
 * Checks browser version
 */
function CheckBrowserSupport() {
    if (!Browser.IsFirefox) {
        if (Browser.IsChrome) {
            AddNoticeItem("Uploads bigger then 100MiB usually crash Chrome when uploading. Please upload with Firefox. Or check <a target=\"_blank\" href=\"https://github.com/v0l/void.cat/releases\">GitHub</a> for tools.");
        }
        if (Browser.IsEdge) {
            let edge_version = /Edge\/([0-9]{1,3}\.[0-9]{1,5})/.exec(navigator.userAgent)[1];
            Log.I(`Edge version is: ${edge_version}`);
            if (parseFloat(edge_version) < 18.18218) {
                AddNoticeItem("Upload progress isn't reported in the version of Edge you are using, see <a target=\"_blank\" href=\"https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/12224510/\">here for more info</a>.");
            }
        }

        document.querySelector('#page-notice').style.display = "block";
    }
}

/**
 * Adds a notice to the UI notice box
 * @param {string} txt - Message to add to notice list
 */
function AddNoticeItem(txt) {
    let ne = document.createElement('li');
    ne.innerHTML = txt;
    document.querySelector('#page-notice ul').appendChild(ne);
}

export { Init, Templates };