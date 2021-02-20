
import { configuration } from "./configuration";
import { OutputChannel, ExtensionContext, commands, window } from "vscode";


const logValueWhiteSpace = 40;
let writeToConsole = true;
let writeToConsoleLevel = 2;
let logOutputChannel: OutputChannel | undefined;



function initLog(settingGrpName: string, dispName: string, context?: ExtensionContext, showLog?: boolean)
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


function log(msg: string, level?: number)
{
    if (msg === null || msg === undefined) {
        return;
    }

    if (isLoggingEnabled())
    {
        const tsMsg = new Date().toISOString().replace(/[TZ]/g, " ") + msg;
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


function logBlank(level?: number)
{
    log("", level);
}


function logError(msg: string | string[])
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


function logValue(msg: string, value: any, level?: number)
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


export {
    initLog, isLoggingEnabled, log, logError, logValue, logBlank
};
