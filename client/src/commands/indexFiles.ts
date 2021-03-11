
import * as fs from "fs";
import { commands, ExtensionContext } from "vscode";
import { extjsLangMgr } from "../extension";


export async function indexFiles()
{

}


function registerIndexFilesCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:ensureRequire", async () => { await indexFiles(); })
    );
}


export default registerIndexFilesCommand;

