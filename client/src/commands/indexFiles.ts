
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


async function indexFiles(project?: string, clean = true, logPad = "")
{
    log.methodStart("index files command", 1, logPad, true);

    if (clean !== false) {
        await commands.executeCommand("vscode-extjs:clearAst", project, false, logPad + "   ");
    }
    await extjsLangMgr.indexFiles(project);

    log.methodDone("index files command", 1, logPad);
}


function registerIndexFilesCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:indexFiles", async (project?: string, clean?: boolean, logPad?: string) => indexFiles(project, clean, logPad))
    );

    //
    // Status bar button
    //
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, -10);
    statusBarItem.text = "$(refresh) extjs";
    statusBarItem.tooltip = "Re-index all ExtJs files";
    statusBarItem.command = "vscode-extjs:indexFiles";
    statusBarItem.hide(); // languageManager will show the control when indexing finishes
}


export default registerIndexFilesCommand;

