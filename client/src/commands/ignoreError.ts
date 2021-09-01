
import { commands, ExtensionContext, Range, Selection, TextDocument, Uri, window } from "vscode";
import { utils } from "../../../common";
import { addIgnoreError } from "../common/ignoreError";
import { extjsLangMgr } from "../extension";


async function ignoreError(code: number, document: TextDocument, range: Range | Selection)
{
	if (code && window.activeTextEditor && window.activeTextEditor.document && document && utils.isExtJsFile(document.getText()))
	{
		const activeTextDocument = window.activeTextEditor.document;
		await addIgnoreError({
			code, fsPath: document.uri.fsPath
		}, document, range);
		await extjsLangMgr.validateDocument(activeTextDocument, extjsLangMgr.getNamespace(activeTextDocument));
	}
}


function registerIgnoreErrorCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:ignoreError",
								 (code: number, document: TextDocument, range: Range | Selection) =>
								{ ignoreError(code, document, range); })
    );
}


export default registerIgnoreErrorCommand;
