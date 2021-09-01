
import {
    Disposable, ExtensionContext, extensions, TextDocumentChangeEvent, Range, Position,
    TextEditor, TextDocument, window, workspace, Uri, ConfigurationChangeEvent, commands, TextDocumentContentChangeEvent
} from "vscode";
import * as path from "path";
import * as assert from "assert";
import { ExtJsApi } from "../../extension";

export let doc: TextDocument;
export let editor: TextEditor;


let activated = false;
let extJsApi: ExtJsApi;
const serverActivationDelay = 2000;
const invalidationDelay = 2000;


/**
 * Activates the spmeesseman.vscode-extjs extension
 */
export async function activate(docUri?: Uri)
{
	const ext = extensions.getExtension("spmeesseman.vscode-extjs")!;
	assert(ext, "Could not find extension");

	const taskExplorerEnabled =  workspace.getConfiguration().get<boolean>("extjsIntellisense.enableTaskExplorer", true);
	await workspace.getConfiguration().update("extjsIntellisense.enableTaskExplorer", true);

	if (!activated)
	{
		extJsApi = await ext.activate();
		await sleep(serverActivationDelay); // Wait for server activation
		activated = true;
	}
	if (docUri) {
		try {
			doc = await workspace.openTextDocument(docUri);
			editor = await window.showTextDocument(doc);
			assert(window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
	}
	if (!taskExplorerEnabled) {
		await workspace.getConfiguration().update("extjsIntellisense.enableTaskExplorer", taskExplorerEnabled);
	}
	extJsApi.extjsLangMgr.setTests(true);
	return { extJsApi , doc };
}


export async function closeActiveDocument()
{
	try {
		await commands.executeCommand("workbench.action.closeActiveEditor");
	}
	catch (e) {
		console.error(e);
	}
}


export async function closeActiveDocuments()
{
	try {
		while (window.activeTextEditor) {
			await commands.executeCommand("workbench.action.closeActiveEditor");
		}
	}
	catch (e) {
		console.error(e);
	}
}


export const getDocPath = (p: string) =>
{
	return path.resolve(__dirname, "../../../../client/testFixture", p);
};


export const getDocUri = (p: string) =>
{
	return Uri.file(getDocPath(p));
};


export const getNewDocUri = (p: string) =>
{
	return Uri.file(getDocPath(p)).with({ scheme: "untitled" });
};


export async function setDocContent(content: string): Promise<boolean>
{
	const all = new Range(
		doc.positionAt(0),
		doc.positionAt(doc.getText().length)
	);
	return editor.edit(eb => eb.replace(all, content));
}


export async function insertDocContent(content: string, range: Range): Promise<boolean>
{
	return editor.edit(eb => eb.replace(range, content));
}


export async function sleep(ms: number)
{
	return new Promise(resolve => setTimeout(resolve, ms));
}


export function toRange(sLine: number, sChar: number, eLine: number, eChar: number)
{
	const start = new Position(sLine, sChar);
	const end = new Position(eLine, eChar);
	return new Range(start, end);
}


export async function waitForValidation()
{
	await sleep(invalidationDelay);
}
