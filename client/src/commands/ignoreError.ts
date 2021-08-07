
import { commands, ExtensionContext, Range, Selection, TextDocument, Uri } from "vscode";
import { addIgnoreError } from "../common/ignoreError";
import { extjsLangMgr } from "../extension";


export async function ignoreError(code: number | undefined, document: TextDocument | undefined, range: Range | Selection | undefined)
{
	if (code)
	{
		await addIgnoreError({
			code, fsPath: document?.uri?.fsPath
		}, document, range);
		await extjsLangMgr.validateDocument();
	}
}


function registerIgnoreErrorCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:ignoreError",
								 (code: number | undefined, document: TextDocument | undefined, range: Range | Selection | undefined) =>
								{ ignoreError(code, document, range); })
    );
}


export default registerIgnoreErrorCommand;
