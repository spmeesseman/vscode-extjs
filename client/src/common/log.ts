
import { configuration } from "./configuration";
import { OutputChannel, ExtensionContext, commands, window, workspace, ConfigurationChangeEvent } from "vscode";


const logValueWhiteSpace = 40;
let writeToConsole = false;
let writeToConsoleLevel = 2;
let logOutputChannel: OutputChannel;
let loggingEnabled = false;


export function initLog(settingGrpName: string, dispName: string, context: ExtensionContext, showLog?: boolean)
{
    //
    // Set up a log in the Output window
    //
    logOutputChannel = window.createOutputChannel(dispName);
    context.subscriptions.push(logOutputChannel);
    context.subscriptions.push(
        commands.registerCommand(settingGrpName + ".showOutput", showLogOutput)
    );
    loggingEnabled = configuration.get<boolean>("debugClient", false);
    //
    // Register configurations/settings change watcher
    //
    context.subscriptions.push(workspace.onDidChangeConfiguration(async e => { await processConfigChanges(context, e); }));
    showLogOutput(showLog);
}


async function processConfigChanges(context: ExtensionContext, e: ConfigurationChangeEvent)
{
    if (e.affectsConfiguration("extjsIntellisense.debugClient"))
    {
        loggingEnabled = configuration.get<boolean>("debugClient", false);
    }
}


function isLoggingEnabled()
{
    return loggingEnabled;
}


export function write(msg: string, level?: number, logPad = "", force = false)
{
    if (force || isLoggingEnabled())
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
            if (m instanceof Error) {
                writeError(m);
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


export function methodStart(msg: string, level: number, logPad: string, doLogBlank?: boolean, params?: (string|any)[][])
{
    if (isLoggingEnabled())
    {
        if (doLogBlank === true) {
            blank(level);
        }
        write(logPad + "*start* " + msg, level);
        if (params)
        {
            for (const [ n, v, l ] of params) {
                value(logPad + "   " + n, v, l || level + 1);
            }
        }
    }
}


export function methodDone(msg: string, level: number, logPad: string, doLogBlank?: boolean, params?: (string|any)[][])
{
    if (isLoggingEnabled())
    {
        if (params)
        {
            for (const [ n, v, l ] of params) {
                value(logPad + "   " + n, v, l || level + 1);
            }
        }
        if (doLogBlank === true) {
            blank(level);
        }
        write("*done* " + msg, level, logPad);
    }
}


export function value(msg: string, value: any, level?: number, logPad = "")
{
    if (isLoggingEnabled())
    {
        let logMsg = msg;
        for (let i = msg.length; i < logValueWhiteSpace - logPad.length; i++) {
            logMsg += " ";
        }

        if (value || value === 0 || value === "" || value === false) {
            logMsg += ": ";
            logMsg += value.toString();
        }
        else if (value === undefined) {
            logMsg += ": undefined";
        }
        else {
            logMsg += ": null";
        }

        write(logMsg, level, logPad);
    }
}


export function values(values: (string|any)[][], level: number, logPad: string, doLogBlank?: boolean)
{
    if (isLoggingEnabled())
    {
        if (doLogBlank === true) {
            blank(level);
        }
        for (const [ n, v, l ] of values) {
            value(n, v, l || level + 1, logPad);
        }
    }
}


export function setWriteToConsole(set: boolean, level?: number)
{
    writeToConsole = set;
    writeToConsoleLevel = level || 1;
}


export function showLogOutput(show?: boolean)
{
    if (show) {
        logOutputChannel.show();
    }
    // else {
    //     logOutputChannel.hide();
    // }
}
