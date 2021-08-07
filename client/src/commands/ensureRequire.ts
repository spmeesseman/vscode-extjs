
import * as json5 from "json5";
import * as log from "../common/log";
import { commands, ExtensionContext, window, workspace, WorkspaceEdit } from "vscode";
import { ComponentType, IPosition, utils } from "../../../common";
import { toVscodePosition, toVscodeRange } from "../common/clientUtils";
import { extjsLangMgr } from "../extension";
import { EOL } from "os";


export async function ensureRequires(xtype: string | undefined)
{
	const document = window.activeTextEditor?.document,
		  fsPath = document?.uri.fsPath,
		  ns = fsPath ? extjsLangMgr.getNamespaceFromFile(fsPath) : undefined,
		  components = ns && fsPath && document ? await extjsLangMgr.indexFile(fsPath, ns, false, document) : undefined,
		  workspaceEdit = new WorkspaceEdit();

	log.methodStart("Command - Ensure requires", 1, "", true, [ [ "fs path", fsPath ] ]);

	if (document && components)
	{
		log.write(`   Found ${components.length} components in class`, 2);

		for (const component of components)
		{
			log.write(`   Processing component '${component.name}'`, 3);

			const componentClasses = new Set<string>();
			for (const x of component.xtypes)
			{
				const c = extjsLangMgr.getMappedClass(x.name, component.nameSpace, ComponentType.Widget);
				if (c !== undefined && utils.isNeedRequire(c) && (!xtype || xtype === x.name)) {
					componentClasses.add(c);
				}
			}
			log.value("      # of xtypes to add", componentClasses.size, 3);

			if (componentClasses.size > 0)
			{
				log.value("      has requires", !!component.requires, 3);

				if (component.requires)
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
				else
				{
					let pad = "";
					const start = component.start;
					start.line += 2;
					start.column = 0;
					if (component.objectRanges && component.objectRanges.length > 0)
					{
						const range = toVscodeRange(component.objectRanges[0].start, component.objectRanges[0].end),
							lineText = document.lineAt(range.start.line).text.substr(0, range.start.character);
						for (let i = 0; i < lineText.length && (lineText[i] === " " || lineText[i] === "\t"); i++)
						{
							pad += lineText[i];
						}
					}
					else {
						pad = "    ";
					}
					const requiresBlock = json5.stringify(Array.from(componentClasses))
											.replace(/\[/, "[" + EOL + pad + "    ")
											.replace(/,/g, "," + EOL + pad + "    ")
											.replace(/\]/, EOL + pad + "]," + EOL + EOL);

					workspaceEdit.insert(document.uri, toVscodePosition(start), pad + "requires: " + requiresBlock);
					workspace.applyEdit(workspaceEdit);
				}
			}
		}
	}

	log.methodDone("Command - Ensure requires", 1);
}


function registerEnsureRequiresCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:ensureRequire", async (xtype) => { await ensureRequires(xtype); })
    );
}


export default registerEnsureRequiresCommand;

