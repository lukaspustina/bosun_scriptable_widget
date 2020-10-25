/*
The MIT License (MIT)

Copyright (c) 2020 Lukas Pustina <lukas@pustina.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/* HOW TO USE
1. Set default config by ',' separated list in variable DEFAULT_CONFIG.
2. Uncomment appropriate run method -- cf. comments starting with 'CONFIG'.
3. Copy to Scriptable.
4. You can set different configs using params strings in the widget configurations.
*/

const DEFAULT_CONFIG = "boson,bosun,http://127.0.0.1:8070"
let LOG_LEVEL, API_URL, AUTH, run

log("Init")

if (is_node()) {
    let params = DEFAULT_CONFIG.split(",")
    let user_name = process.env.BOSUN_USER_NAME || params[0]
    let password = process.env.BOSUN_PASSWORD || params[1]
    let url = process.env.BOSUN_URL || params[2]

    run = node

    LOG_LEVEL = process.env.LOG_LEVEL || 2
    API_URL = url + "/api"
    AUTH = "Basic " + Buffer.from(user_name + ":" + password).toString("base64")
} else {
    let params = (args.widgetParameter || DEFAULT_CONFIG).split(",")
    let user_name = params[0]
    let password = params[1]
    let url = params[2]

    run = ios

    LOG_LEVEL = 2
    API_URL = url + "/api"
    AUTH = "Basic " + btoa(user_name + ":" + password)
}

// CONFIG: Uncomment for node
run(API_URL + "/alerts", AUTH)

// CONFIG: Uncomment for iOS
// await run(API_URL + "/alerts", AUTH)

async function node(api_alerts, auth) {
    log("Start")

    let alerts = await get_alerts_node(api_alerts, auth)
    let statistics = analyze(alerts)
    info("Statistics: " + JSON.stringify(statistics))

    log("Finished")
}

async function get_alerts_node(url, auth) {
    const fetch = require("node-fetch")
    const Request = fetch.Request

    log("Querying Bosun for alerts...")
    let request = await new Request(url, {
        method: "GET",
        headers: {
            "Authorization": auth,
            'User-agent': 'Bosun Widget'
        }
    })
    trace(JSON.stringify(request.headers))

    let response = await fetch(request)
    debug("HTTP Status: " + response.status)

    let json = await response.json()
    trace(JSON.stringify(json))
    log("... done.")

    return json
}

async function ios(api_alerts, auth) {
    console.log("Start")

    let alerts = await get_alerts_ios(api_alerts, auth)
    let statistics = analyze(alerts)
    info("Statistics: " + JSON.stringify(statistics))
    await render_widget(statistics)

    log("Finished")
}

async function get_alerts_ios(url, auth) {
    log("Querying Bosun for alerts...")
    let request = new Request(url)
    request.headers = {
        "Authorization": auth,
        'User-agent': 'Bosun Widget'
    }
    request.allowInsecureRequest = true
    trace(JSON.stringify(request.headers))

    let json = await request.loadJSON()
    trace(JSON.stringify(json))
    log("... done.")

    return json
}

async function render_widget(statistics) {
    let widget = await create_widget(statistics)
    if (config.runsInWidget) {
        Script.setWidget(widget)
    } else {
        widget.presentMedium()
    }
    Script.complete()
}

async function create_widget(statistics) {
    const list = new ListWidget()
    list.refreshAfterDate = new Date(Date.now() + 300.000) // Refresh not earlier than in 5 min

    let header = list.addText("🚦 Bosun".toUpperCase())
    header.leftAlignText()
    header.font = Font.mediumSystemFont(10)

    list.addSpacer()

    let unacked_total = list.addText("❌ Unacked: " + statistics.unacked.total)
    unacked_total.font = Font.mediumSystemFont(10)
    let unacked_active_crit = list.addText(" ∙ 🔴 Crit: " + statistics.unacked.active.crit)
    unacked_active_crit.font = Font.mediumSystemFont(10)
    let unacked_active_warn = list.addText(" ∙ 🟡 Warn: " + statistics.unacked.active.warn)
    unacked_active_warn.font = Font.mediumSystemFont(10)
    let unacked_active_unknown = list.addText(" ∙ 🔵 Unknown: " + statistics.unacked.active.unknown)
    unacked_active_unknown.font = Font.mediumSystemFont(10)
    let unacked_active_ok = list.addText(" ∙ 🟢 Ok: " +
        (statistics.unacked.total - statistics.unacked.active.crit - statistics.unacked.active.warn - statistics.unacked.active.unknown))
    unacked_active_ok.font = Font.mediumSystemFont(10)

    list.addSpacer()

    let acked = list.addText("✅ Acked: " + statistics.acked.total)
    acked.font = Font.mediumSystemFont(10)

    list.addSpacer()


    let date_format = new DateFormatter()
    date_format.useLongDateStyle()
    date_format.useMediumTimeStyle()
    date_str = date_format.string(new Date(Date.now()))
    let date = list.addText(date_str)
    date.font = Font.mediumSystemFont(10)
    date.textColor = Color.gray()

    return list
}

function analyze(alerts) {
    let statistics = {
        unacked: {
            total: alerts.Groups.NeedAck.length,
            active: {
                total: alerts.Groups.NeedAck.filter(a => a.CurrentStatus != 'normal').length,
                unknown: alerts.Groups.NeedAck.filter(a => a.CurrentStatus === 'unknown').length,
                crit: alerts.Groups.NeedAck.filter(a => a.CurrentStatus === 'critical').length,
                warn: alerts.Groups.NeedAck.filter(a => a.CurrentStatus === 'warning').length
            }
        },
        acked: {
            total: alerts.Groups.Acknowledged.length
        }
    }

    trace(JSON.stringify(statistics))
    return statistics
}

function info(msg) {
    log_level(msg, 2)
}

function debug(msg) {
    log_level(msg, 3)
}

function trace(msg) {
    log_level(msg, 4)
}

function log_level(msg, level) {
    if (LOG_LEVEL >= level) { log(msg) }
}

function log(msg) {
    console.log(msg)
}

function is_node() {
    return ((typeof process !== 'undefined') && (process.release.name === 'node'))
}
