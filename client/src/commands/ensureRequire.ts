
import * as json5 from "json5";
import * as log from "../common/log";
import { commands, ExtensionContext, window, workspace, WorkspaceEdit } from "vscode";
import { ComponentType, IRequire, extjs } from "../../../common";
import { getWorkspaceProjectName, quoteChar, toVscodePosition, toVscodeRange } from "../common/clientUtils";
import { extjsLangMgr } from "../extension";
import { EOL } from "os";


async function ensureRequires(xtype: string | undefined, type: "type" | "xtype" = "xtype")
{
	const document = window.activeTextEditor?.document;
	if (!document) {
		return;
	}

	log.methodStart("Command - Ensure requires", 1, "", true);

	const fsPath = document.uri.fsPath,
		  project = getWorkspaceProjectName(fsPath),
		  thisCmp = extjsLangMgr.getComponentByFile(fsPath, "   ", 3),
		  fileWidgets = thisCmp ? await extjsLangMgr.indexFile(fsPath, thisCmp.nameSpace, false, document, true, "   ", 2) : undefined,
		  workspaceEdit = new WorkspaceEdit(),
		  quote = quoteChar();

	if (fileWidgets)
	{
		log.write(`   Found ${fileWidgets.length} widgets in class`, 2);

		for (const component of fileWidgets)
		{
			log.write(`   Processing component '${component.name}'`, 3);

			const componentClasses = new Set<string>();
			component.widgets.filter(w => w.type === type && (!xtype || xtype === w.name)).forEach(w =>
			{
				const c = extjsLangMgr.getComponent(w.name, project, "   ", 3, w.end, thisCmp)?.componentClass;
				if (c !== undefined && extjs.isNeedRequire(c, extjsLangMgr.getComponents())) {
					componentClasses.add(c);
				}
			});
			log.value(`      # of ${type}s to add`, componentClasses.size, 3);

			//
			// The 'componentClasses' set holds the list of requires that "should" be included
			//
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
											   .filter((it: IRequire) => extjs.isNeedRequire(it.name, extjsLangMgr.getComponents()))
											   .map((it: IRequire) => { return it.name; })
											   .concat(Array.from(componentClasses))
											   .sort();

					const requiresBlock = json5.stringify(Array.from(new Set(_requires)))
											   .replace(/\[/, "[" + EOL + pad + "    ")
											   .replace(/,/g, "," + EOL + pad + "    ")
											   .replace(/\]/, EOL + pad + "]")
											   .replace(/"/g, quote);
					workspaceEdit.replace(document.uri, range, "requires: " + requiresBlock);
					workspace.applyEdit(workspaceEdit);
				}
				else
				{
					let pad = "    ";
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

	log.methodDone("Command - Ensure requires", 1, "", true);
}


function registerEnsureRequiresCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerCommand("vscode-extjs:ensureRequire", async (xtype, type) => { await ensureRequires(xtype, type); })
    );
}


export default registerEnsureRequiresCommand;

