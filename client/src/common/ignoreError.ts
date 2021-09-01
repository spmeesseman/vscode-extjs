
import { configuration } from "./configuration";
import { IError } from "../../../common";
import { Position, Range, Selection, TextDocument, Uri, workspace, WorkspaceEdit } from "vscode";
import { EOL } from "os";


async function addIgnoreError(error: IError, document: TextDocument, range: Range | Selection)
{
	const ignoreErrors = configuration.get<IError[]>("ignoreErrors", []);

	if (!range && error.code)
	{
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
		workspaceEdit.insert(document.uri, nPosition, `/** vscode-extjs-ignore-${error.code} */${EOL}${pad}`);
		workspace.applyEdit(workspaceEdit);
	}
}


export { addIgnoreError };
