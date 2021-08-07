
import { connection, globalSettings } from "./server";

const logValueWhiteSpace = 40;


export function write(msg: string, level?: number, logPad = "")
{
    if (msg === null || msg === undefined) {
        return;
    }

    if (globalSettings.debugServer === true)
    {
        const tsMsg = new Date().toISOString().replace(/[TZ]/g, " ") + logPad + msg;
        if (!level || (globalSettings.debugLevel !== undefined && level <= globalSettings.debugLevel)) {
            connection.console.log(tsMsg);
        }
    }
}


export function blank(level?: number)
{
    write("", level);
}


export function error(msg: string | string[])
{
    if (msg === null || msg === undefined) {
        return;
    }
    write("***");
    if (typeof msg === "string") {
        write("*** " + msg);
    }
    else {
        msg.forEach((m: string) => {
            write("*** " + m);
        });
    }
    write("***");
}


export function methodStart(msg: string, level?: number, logPad = "", doLogBlank?: boolean, params?: (string|any)[][])
{
    if (msg === null || msg === undefined) {
        return;
    }

    if (globalSettings.debugServer === true)
    {
        const lLevel = level || 1;
        if (doLogBlank === true) {
            blank(lLevel);
        }
        write(logPad + "*start* " + msg, lLevel);
        if (params)
        {
            for (const [ n, v] of params) {
                value(logPad + "   " + n, v, lLevel + 1);
            }
        }
    }
}


export function methodDone(msg: string, level?: number, logPad = "", doLogBlank?: boolean, params?: (string|any)[][])
{
    if (msg === null || msg === undefined) {
        return;
    }

    if (globalSettings.debugServer === true)
    {
        const lLevel = level || 1;
        if (doLogBlank === true) {
            blank(lLevel);
        }
        if (params)
        {
            for (const [ n, v] of params) {
                value(logPad + "   " + n, v, lLevel + 1);
            }
        }
        write("*done* " + msg, lLevel, logPad);
    }
}


export function value(msg: string, value: any, level?: number, logPad = "")
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

    write(logMsg, level, logPad);
}
