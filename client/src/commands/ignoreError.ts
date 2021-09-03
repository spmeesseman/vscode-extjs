
import { commands, ExtensionContext, Position, Range, Selection, TextDocument, window, workspace, WorkspaceEdit } from "vscode";
import { utils, IError } from "../../../common";
import { documentEol } from "../common/clientUtils";
import { configuration } from "../common/configuration";
import { extjsLangMgr } from "../extension";


async function ignoreError(code: number, document: TextDocument, range: Range | Selection)
{
	if (code && window.activeTextEditor && window.activeTextEditor.document && document && utils.isExtJsFile(document.getText()))
	{
		const activeTextDocument = window.activeTextEditor.document;
		await addIgnoreError({
			code, fsPath: document.uri.fsPath
		}, document, range);
		await extjsLangMgr.validateDocument(activeTextDocument, extjsLangMgr.getNamespace(activeTextDocument), "", 1);
	}
}


async function addIgnoreError(error: IError, document: TextDocument, range: Range | Selection)
{
	if (!range && error.code)
	{
		const ignoreErrors = configuration.get<IError[]>("ignoreErrors", []);
		for (const iErr of ignoreErrors) {
			if (iErr.code === error.code) {
				if (!iErr.fsPath || iErr.fsPath === error.fsPath) {
					return;
				}
			}
		}
		ignoreErrors.push(error);
		await configuration.update("ignoreErrors", ignoreErrors);
	}
	else
	{
		const workspaceEdit = new WorkspaceEdit(),
				line = document.lineAt(range.start.line),
				lineText = line.text.substr(0, range.start.character);
		let pad = "",
			firstChar = lineText.trimEnd().lastIndexOf(" ") + 1;

		if (firstChar === 0) {
			firstChar = lineText.trimEnd().lastIndexOf("\t") + 1;
		}

		for (let i = 0; i < lineText.length && (lineText[i] === " " || lineText[i] === "\t"); i++) {
			pad += lineText[i];
		}

		const nPosition = new Position(range.start.line, firstChar);
		workspaceEdit.insert(document.uri, nPosition, `/** vscode-extjs-ignore-${error.code} */${documentEol(document)}${pad}`);
		workspace.applyEdit(workspaceEdit);
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
