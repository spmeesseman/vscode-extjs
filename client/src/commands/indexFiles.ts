
import * as log from "../common/log";
import { commands, ExtensionContext, StatusBarAlignment, StatusBarItem, window } from "vscode";
import { extjsLangMgr } from "../extension";

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


export async function indexFiles(nameSpace?: string, logPad = "")
{
    log.methodStart("index files command", 1, logPad, true);

    if (!extjsLangMgr.isBusy())
    {
        await commands.executeCommand("vscode-extjs:clearAst", nameSpace, false, logPad + "   ");
        await extjsLangMgr.indexFiles(nameSpace);
    }

    log.methodStart("index files command", 1, logPad);
}


function registerIndexFilesCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:indexFiles", async () => { await indexFiles(); })
    );

    //
    // Status bar button
    //
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, -10);
    statusBarItem.text = "$(refresh)";
    statusBarItem.tooltip = "Re-index all ExtJs files";
    statusBarItem.command = "vscode-extjs:indexFiles";
    statusBarItem.hide(); // LanguageManager will show the control when indexing finishes
}


export default registerIndexFilesCommand;

