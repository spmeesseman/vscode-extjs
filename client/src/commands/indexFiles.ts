
import { rmdirSync } from "fs";
import { commands, ExtensionContext, StatusBarAlignment, window } from "vscode";
import { extjsLangMgr } from "../extension";

let fsStoragePath: string;


export async function indexFiles()
{
    if (!extjsLangMgr.isBusy())
    {
        rmdirSync(fsStoragePath);
        await extjsLangMgr.indexFiles();
    }
}


function registerIndexFilesCommand(context: ExtensionContext)
{
    fsStoragePath = context.globalStoragePath;
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:indexFiles", async () => { await indexFiles(); })
    );

    //
    // Status bar button
    //
    const statusBarSpace = window.createStatusBarItem(StatusBarAlignment.Left, -10000);
    statusBarSpace.text = "$(refresh)";
    statusBarSpace.tooltip = "Re-index all ExtJs files";
    statusBarSpace.command = "vscode-extjs:indexFiles";
    statusBarSpace.show();
}


export default registerIndexFilesCommand;

