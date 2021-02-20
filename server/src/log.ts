
import { connection, globalSettings } from "./server";

const logValueWhiteSpace = 40;


export function log(msg: string, level?: number)
{
    if (msg === null || msg === undefined) {
        return;
    }

    if (globalSettings.debugServer === true)
    {
        const tsMsg = new Date().toISOString().replace(/[TZ]/g, " ") + msg;
        if (!level || (globalSettings.debugLevel !== undefined && level <= globalSettings.debugLevel)) {
            connection.console.log(tsMsg);
        }
    }
}


export function logBlank(level?: number)
{
    log("", level);
}


export function logError(msg: string | string[])
{
    if (!msg === null || msg === undefined) {
        return;
    }
    log("***");
    if (typeof msg === "string") {
        log("*** " + msg);
    }
    else {
        msg.forEach((m: string) => {
            log("*** " + m);
        });
    }
    log("***");
}


export function logValue(msg: string, value: any, level?: number)
{
    let logMsg = msg;
    const spaces = msg && msg.length ? msg.length : (value === undefined ? 9 : 4);
    for (let i = spaces; i < logValueWhiteSpace; i++) {
        logMsg += " ";
    }

    if (value || value === 0 || value === "" || value === false) {
        logMsg += ": ";
        logMsg += value.toString();
    }
    else if (value === undefined) {
        logMsg += ": undefined";
    }
    else if (value === null) {
        logMsg += ": null";
    }

    log(logMsg, level);
}
