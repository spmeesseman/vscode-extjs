
import * as vscode from "vscode";
import * as path from "path";
import * as assert from "assert";
import { extjsLangMgr } from "../../extension";

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;


let activated = false;
const serverActivationDelay = 2000;
const invalidationDelay = 2000;


/**
 * Activates the spmeesseman.vscode-extjs extension
 */
export async function activate(docUri?: vscode.Uri)
{
	let extJsApi = {};
	const ext = vscode.extensions.getExtension("spmeesseman.vscode-extjs")!;
	assert(ext, "Could not find extension");
	if (!activated)
	{
		extJsApi = await ext.activate();
		await sleep(serverActivationDelay); // Wait for server activation
		activated = true;
	}
	if (docUri) {
		try {
			doc = await vscode.workspace.openTextDocument(docUri);
			editor = await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
	}
	extjsLangMgr.setTests(true);
	return doc;
}


export const getDocPath = (p: string) =>
{
	return path.resolve(__dirname, "../../../../client/testFixture", p);
};


export const getDocUri = (p: string) =>
{
	return vscode.Uri.file(getDocPath(p));
};


export const getNewDocUri = (p: string) =>
{
	return vscode.Uri.file(getDocPath(p)).with({ scheme: "untitled" });
};


export async function setDocContent(content: string): Promise<boolean>
{
	const all = new vscode.Range(
		doc.positionAt(0),
		doc.positionAt(doc.getText().length)
	);
	return editor.edit(eb => eb.replace(all, content));
}


export async function insertDocContent(content: string, range: vscode.Range): Promise<boolean>
{
	return editor.edit(eb => eb.replace(range, content));
}


export async function sleep(ms: number)
{
	return new Promise(resolve => setTimeout(resolve, ms));
}


export function toRange(sLine: number, sChar: number, eLine: number, eChar: number)
{
	const start = new vscode.Position(sLine, sChar);
	const end = new vscode.Position(eLine, eChar);
	return new vscode.Range(start, end);
}


export async function waitForValidation()
{
	await sleep(invalidationDelay);
}
