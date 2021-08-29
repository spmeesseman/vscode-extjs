
import { connection, globalSettings } from "./server";

const logValueWhiteSpace = 40;


export function write(msg: string, level?: number, logPad = "", force = false)
{
    if (msg === null || msg === undefined) {
        return;
    }

    if (force || globalSettings.debugServer === true)
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


function writeError(e: Error)
{
    write("*** " + e.name, undefined, "", true);
    write("*** " + e.message, undefined, "", true);
    if (e.stack) {
        const stackFmt = e.stack.replace(/\n/g, "\n                        *** ");
        write("*** " + stackFmt, undefined, "", true);
    }
}


export function error(msg: string | (string|Error)[] | Error, params?: (string|any)[][])
{
    write("***", undefined, "", true);
    if (typeof msg === "string") {
        write("*** " + msg, undefined, "", true);
    }
    else if (msg instanceof Error) {
        writeError(msg);
    }
    else {
        msg.forEach((m: string | Error) => {
            if (msg instanceof Error) {
                writeError(msg);
            }
            else {
                write("*** " + m, undefined, "", true);
            }
        });
    }
    if (params)
    {
        for (const [ n, v, l ] of params) {
            value("***   " + n, v);
        }
    }
    write("***", undefined, "", true);
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


export function values(values: (string|any)[][], level?: number, logPad = "", doLogBlank?: boolean)
{
    if (globalSettings.debugServer === true)
    {
        const lLevel = level || 1;
        if (doLogBlank === true) {
            blank(lLevel);
        }
        if (values)
        {
            for (const [ n, v, l ] of values) {
                value(n, v, l || lLevel + 1, logPad);
            }
        }
    }
}
