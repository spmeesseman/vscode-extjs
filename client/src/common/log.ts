
import { configuration } from "./configuration";
import { OutputChannel, ExtensionContext, commands, window } from "vscode";


const logValueWhiteSpace = 40;
let writeToConsole = false;
let writeToConsoleLevel = 2;
let logOutputChannel: OutputChannel | undefined;


export function initLog(settingGrpName: string, dispName: string, context?: ExtensionContext, showLog?: boolean)
{
    function showLogOutput(show?: boolean)
    {
        if (logOutputChannel && show) {
            logOutputChannel.show();
        }
    }
    //
    // Set up a log in the Output window
    //
    logOutputChannel = window.createOutputChannel(dispName);
    if (context)
    {
        context.subscriptions.push(logOutputChannel);
        context.subscriptions.push(
            commands.registerCommand(settingGrpName + ".showOutput", showLogOutput)
        );
    }
    showLogOutput(showLog);
}


function isLoggingEnabled()
{
    return configuration.get("debugClient") === true;
}


export function write(msg: string, level?: number, logPad = "")
{
    if (msg === null || msg === undefined) {
        return;
    }

    if (isLoggingEnabled())
    {
        const tsMsg = new Date().toISOString().replace(/[TZ]/g, " ") + logPad + msg;
        if (logOutputChannel && (!level || level <= configuration.get<number>("debugLevel"))) {
            logOutputChannel.appendLine(tsMsg);
        }
        if (writeToConsole === true) {
            if (!level || level <= writeToConsoleLevel) {
                console.log(tsMsg);
            }
        }
    }
}


export function blank(level?: number)
{
    write("", level);
}


export function error(msg: string | string[])
{
    if (!msg === null || msg === undefined) {
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

    if (isLoggingEnabled())
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


export function methodDone(msg: string, level?: number, logPad = "", doLogBlank?: boolean, params?: [string, any][])
{
    if (msg === null || msg === undefined) {
        return;
    }

    if (isLoggingEnabled())
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


export function setWriteToConsole(set: boolean, level = 2)
{
    writeToConsole = set;
    writeToConsoleLevel = level;
}
