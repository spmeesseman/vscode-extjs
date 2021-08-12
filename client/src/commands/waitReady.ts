
import * as util from "../../../common/lib/utils";
import * as log from "../common/log";
import { commands, ExtensionContext } from "vscode";
import { extjsLangMgr } from "../extension";

let fsStoragePath: string;


export async function waitReady(logPad = "")
{
    log.methodStart("wait ready command", 1, logPad, true, [["cache path", fsStoragePath]]);

    let ct = 0;
    while ((extjsLangMgr.isBusy() || ct === 0) && ct < 120) {
        ++ct;
        await util.timeout(250);
    }

    log.methodStart("clear ast command", 1, logPad);
}


function registerWaitReadyCommand(context: ExtensionContext)
{
    fsStoragePath = context.globalStoragePath;
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:waitReady", async (logPad = "") => { await waitReady(logPad); })
    );
}


export default registerWaitReadyCommand;
