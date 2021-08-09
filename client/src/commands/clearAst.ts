
import { rmdirSync } from "fs";
import { commands, ExtensionContext } from "vscode";
import { extjsLangMgr } from "../extension";

let fsStoragePath: string;


export async function clearAst()
{
    if (!extjsLangMgr.isBusy())
    {
        rmdirSync(fsStoragePath, {
            recursive: true
        });
    }
}


function registerClearAstCommand(context: ExtensionContext)
{
    fsStoragePath = context.globalStoragePath;
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:clearAst", async () => { await clearAst(); })
    );
}


export default registerClearAstCommand;
