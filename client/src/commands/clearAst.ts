
import * as path from "path";
import * as log from "../common/log";
import { rmdirSync } from "fs";
import { commands, ExtensionContext } from "vscode";
import { extjsLangMgr } from "../extension";

let fsStoragePath: string;


export async function clearAst(nameSpace?: string, logPad = "")
{
    log.methodStart("clear ast command", 1, logPad, true, [["cache path", fsStoragePath]]);

    if (!extjsLangMgr.isBusy())
    {
        let nsPath = fsStoragePath;
        if (nameSpace) {
            nsPath = path.join(fsStoragePath, nameSpace);
        }

        log.value("   removing directory", nsPath, 1, logPad);
        rmdirSync(nsPath, {
            recursive: true
        });
    }
    else {
        log.write("   busy, did not run command", 1, logPad);
    }

    log.methodStart("clear ast command", 1, logPad);
}


function registerClearAstCommand(context: ExtensionContext)
{
    fsStoragePath = context.globalStoragePath;
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:clearAst", async () => { await clearAst(); })
    );
}


export default registerClearAstCommand;
