
import { commands, ExtensionContext, Range, Uri } from "vscode";
import { addIgnoreError } from "../common/ignoreError";
import { extjsLangMgr } from "../extension";


export async function ignoreError(code: number | undefined, fsPath: string | undefined)
{
	if (code)
	{
		await addIgnoreError({
			code, fsPath
		});
		await extjsLangMgr.validateDocument();
	}
}


function registerIgnoreErrorCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:ignoreError",
								 (code: number | undefined, fsPath: string | undefined) =>
								{ ignoreError(code, fsPath); })
    );
}


export default registerIgnoreErrorCommand;
