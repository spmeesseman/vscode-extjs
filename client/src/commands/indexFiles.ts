
import { rmdirSync } from "fs";
import { commands, ExtensionContext, StatusBarAlignment, StatusBarItem, window } from "vscode";
import { extjsLangMgr } from "../extension";

let fsStoragePath: string;
let statusBarItem: StatusBarItem;


export function showReIndexButton(show = true)
{
    if (show) {
        statusBarItem.show();
    }
    else {
        statusBarItem.hide();
    }
}


export async function indexFiles()
{
    if (!extjsLangMgr.isBusy())
    {
        rmdirSync(fsStoragePath, {
            recursive: true
        });
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
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, -10000);
    statusBarItem.text = "$(refresh)";
    statusBarItem.tooltip = "Re-index all ExtJs files";
    statusBarItem.command = "vscode-extjs:indexFiles";
    statusBarItem.hide(); // LanguageManager will show the control when indexing finishes
}


export default registerIndexFilesCommand;

