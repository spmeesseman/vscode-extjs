
import * as path from "path";
import * as assert from "assert";
import { ExtJsApi } from "../../common/interface";
import { extensions, TextEditor, TextDocument, window, workspace, Uri, commands, Range, Position } from "vscode";
import { configuration } from "../../common/configuration";

export let doc: TextDocument;
export let editor: TextEditor;


let activated = false;
let extJsApi: ExtJsApi;
const serverActivationDelay = 2500;
const invalidationDelay = 400;
let docValidationDelay: number | undefined;
let taskExplorerEnabled: boolean;

/**
 * Activates the spmeesseman.vscode-extjs extension
 */
export async function activate(docUri?: Uri)
{
	const ext = extensions.getExtension("spmeesseman.vscode-extjs")!;
	assert(ext, "Could not find extension");

	if (!activated)
	{
		taskExplorerEnabled =  workspace.getConfiguration().get<boolean>("extjsIntellisense.enableTaskView", true);
		await workspace.getConfiguration().update("extjsIntellisense.enableTaskView", true);
		extJsApi = await ext.activate();
		await sleep(serverActivationDelay); // Wait for server activation
		if (!taskExplorerEnabled) {
			await workspace.getConfiguration().update("extjsIntellisense.enableTaskView", taskExplorerEnabled);
		}
		//
		// Set debounce to minimum for tests
		//
		docValidationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250);
		extJsApi.extjsLangMgr.setTests(true);
		activated = true;
	}
	if (docUri) {
		try {
			doc = await workspace.openTextDocument(docUri);
			editor = await window.showTextDocument(doc);
			assert(window.activeTextEditor, "No active editor");
			await waitForValidation();
		} catch (e) {
			console.error(e);
		}
	}
	return { extJsApi , doc };
}


export async function cleanup()
{
	await configuration.update("validationDelay", docValidationDelay);
	await workspace.getConfiguration().update("extjsIntellisense.enableTaskView", taskExplorerEnabled);
}


export async function closeActiveDocument()
{
	try {
		await commands.executeCommand("workbench.action.closeActiveEditor");
	}
	catch (e) {
		console.error(e);
	}
	// await waitForValidation();
}


export async function closeActiveDocuments()
{
	try {
		// while (window.activeTextEditor) {
			await commands.executeCommand("workbench.action.closeActiveEditor");
		// }
	}
	catch (e) {
		console.error(e);
	}
	// await waitForValidation();
}


export const getDocPath = (p: string) =>
{
	return path.normalize(path.resolve(__dirname, "../../../../client/testFixture", p));
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


export async function insertDocContent(content: string, range: Range, save?: boolean)
{
	await editor.edit(eb => eb.replace(range, content));
	if (save === true) {
		await workspace.saveAll();
	}
	await waitForValidation();
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


export async function waitForValidation(doWaitReady?: boolean, delay?: number)
{
	await sleep(delay || invalidationDelay);
	if (doWaitReady !== false) {
		await commands.executeCommand("vscode-extjs:waitReady");
	}
}
