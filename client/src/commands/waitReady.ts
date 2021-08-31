
import * as util from "../../../common/lib/utils";
import * as log from "../common/log";
import { commands, ExtensionContext } from "vscode";
import { extjsLangMgr } from "../extension";


async function waitReady(logPad = "   ", timeout = 120000, logLevel = 3)
{
    log.methodStart("wait ready command", logLevel, logPad);

    let ct = 0;
    const sleepPeriod = 250;

    while ((extjsLangMgr.isBusy() || ct === 0) && ct < timeout) {
        ct += sleepPeriod;
        await util.timeout(sleepPeriod);
    }

    log.methodDone("wait ready command", logLevel, logPad);
}


function registerWaitReadyCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:waitReady", async (logPad?: string, timeout?: number, logLevel?: number) => { await waitReady(logPad, timeout, logLevel); })
    );
}


export default registerWaitReadyCommand;
