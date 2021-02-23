
import json5 from "json5";
import { window, workspace, WorkspaceEdit } from "vscode";
import { utils } from "../../../common";
import { getComponentClass, getNamespaceFromFile } from "../languageManager";
import { toVscodeRange } from "../common/clientUtils";
import { extjsLangMgr } from "../extension";
import { EOL } from "os";


export async function ensureRequires()
{
	const document = window.activeTextEditor?.document;
	if (!document) {
		return;
	}

	const fsPath = document.uri.fsPath,
			ns = getNamespaceFromFile(fsPath);

	if (!ns) {
		window.showErrorMessage("Could not find base namespace");
		return;
	}

	const components = await extjsLangMgr.indexFile(fsPath, ns, document),
		  workspaceEdit = new WorkspaceEdit();

	if (!components) {
		window.showErrorMessage("Could not find component syntax tree");
		return;
	}

	for (const component of components)
	{
		if (!component.requires) {
			continue;
		}

		const componentClasses = new Set<string>();

		for (const x of component.xtypes)
		{
			const c = getComponentClass(x.name);
			if (c !== undefined && utils.isNeedRequire(c)) {
				componentClasses.add(c);
			}
		}

		if (componentClasses.size > 0)
		{
			const _requires = component.requires.value
				.filter(it => utils.isNeedRequire(it))
				.concat(Array.from(componentClasses))
				.sort();
			let pad = "";
			const range = toVscodeRange(component.requires.start, component.requires.end),
			      lineText = document.lineAt(range.start.line).text.substr(0, range.start.character);
			for (let i = 0; i < lineText.length; i++)
			{
				if (lineText[i] === "\t") {
					pad += "    ";
				}
				else if (lineText[i] === " ") {
					pad += " ";
				}
				else {
					break;
				}
			}
			const requiresBlock = json5.stringify(Array.from(new Set(_requires)))
									   .replace(/\[/, "[" + EOL + pad + "    ")
									   .replace(/,/g, "," + EOL + pad + "    ")
									   .replace(/\]/, EOL + pad + "]");
			workspaceEdit.replace(document.uri, range, "requires: " + requiresBlock);
			workspace.applyEdit(workspaceEdit);
		}
	}
}
