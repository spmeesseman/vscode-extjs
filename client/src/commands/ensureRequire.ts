
import * as json5 from "json5";
import { commands, ExtensionContext, window, workspace, WorkspaceEdit } from "vscode";
import { ComponentType, utils } from "../../../common";
import { toVscodeRange } from "../common/clientUtils";
import { extjsLangMgr } from "../extension";
import { EOL } from "os";


export async function ensureRequires(xtype: string | undefined)
{
	const document = window.activeTextEditor?.document,
		  fsPath = document?.uri.fsPath,
		  ns = fsPath ? extjsLangMgr.getNamespaceFromFile(fsPath) : undefined,
		  components = ns && fsPath && document ? await extjsLangMgr.indexFile(fsPath, ns, false, document) : undefined,
		  workspaceEdit = new WorkspaceEdit();

	if (document && components)
	{
		for (const component of components)
		{
			if (component.requires)
			{
				const componentClasses = new Set<string>();

				for (const x of component.xtypes)
				{
					const c = extjsLangMgr.getMappedClass(x.name, ComponentType.Widget);
					if (c !== undefined && utils.isNeedRequire(c) && (!xtype || xtype === x.name)) {
						componentClasses.add(c);
					}
				}

				if (componentClasses.size > 0)
				{
					let pad = "";
					const range = toVscodeRange(component.requires.start, component.requires.end),
						lineText = document.lineAt(range.start.line).text.substr(0, range.start.character);

					for (let i = 0; i < lineText.length && (lineText[i] === " " || lineText[i] === "\t"); i++)
					{
						pad += lineText[i];
					}

					const _requires = component.requires.value
						.filter((it: string) => utils.isNeedRequire(it))
						.concat(Array.from(componentClasses))
						.sort();

					const requiresBlock = json5.stringify(Array.from(new Set(_requires)))
											.replace(/\[/, "[" + EOL + pad + "    ")
											.replace(/,/g, "," + EOL + pad + "    ")
											.replace(/\]/, EOL + pad + "]");

					workspaceEdit.replace(document.uri, range, "requires: " + requiresBlock);
					workspace.applyEdit(workspaceEdit);
				}
			}
		}
	}
}


function registerEnsureRequiresCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:ensureRequire", async (xtype) => { await ensureRequires(xtype); })
    );
}


export default registerEnsureRequiresCommand;

