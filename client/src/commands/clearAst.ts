
import * as log from "../common/log";
import { rmdirSync } from "fs";
import { commands, ExtensionContext } from "vscode";
import { extjsLangMgr } from "../extension";

let fsStoragePath: string;


export async function clearAst()
{
    log.methodStart("clear ast command", 1, "", true, [["cache path", fsStoragePath]]);

    if (!extjsLangMgr.isBusy())
    {
        rmdirSync(fsStoragePath, {
            recursive: true
        });
    }

    log.methodStart("clear ast command", 1);
}


function registerClearAstCommand(context: ExtensionContext)
{
    fsStoragePath = context.globalStoragePath;
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:clearAst", async () => { await clearAst(); })
    );
}


export default registerClearAstCommand;
