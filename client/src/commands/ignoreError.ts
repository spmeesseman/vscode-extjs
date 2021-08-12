
import { commands, ExtensionContext, Range, Selection, TextDocument, Uri, window } from "vscode";
import { addIgnoreError } from "../common/ignoreError";
import { extjsLangMgr } from "../extension";


export async function ignoreError(code: number | undefined, document: TextDocument | undefined, range: Range | Selection | undefined)
{
	if (code)
	{
		if (window.activeTextEditor)
		{
			const activeTextDocument = window.activeTextEditor.document;
			await addIgnoreError({
				code, fsPath: document?.uri?.fsPath
			}, document, range);
			await extjsLangMgr.validateDocument(activeTextDocument, extjsLangMgr.getNamespace(activeTextDocument));
		}
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
