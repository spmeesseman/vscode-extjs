
import * as vscode from "vscode";
import * as path from "path";
import * as assert from "assert";

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
export async function activate(docUri: vscode.Uri)
{
	const ext = vscode.extensions.getExtension("spmeesseman.vscode-extjs")!;
	assert(ext, "Could not find extension");
	if (!activated)
	{
		await ext.activate();
		try {
			doc = await vscode.workspace.openTextDocument(docUri);
			editor = await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
			await sleep(serverActivationDelay); // Wait for server activation
			activated = true;
		} catch (e) {
			console.error(e);
		}
	}
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


/*
test("Enable required testing options", async function()
{
	this.timeout(10 * 1000);
	assert.ok(vscode.extensions.getExtension("spmeesseman.vscode-extjs"));
	//await initSettings(false);
	//log.setWriteToConsole(true); // FOR DEBUGGING - write debug logging from exiension to console
});


test("Get active extension", async function()
{
	let wait = 0;
	const maxWait = 15;  // seconds

	this.timeout(60 * 1000);

	const ext = vscode.extensions.getExtension("spmeesseman.vscode-extjs");
	assert(ext, "Could not find extension");

	//
	// For coverage, we remove activationEvents "*" in package.json, we should
	// not be active at this point
	//
	if (!ext.isActive && !activated)
	{
		activated = true;
		console.log("        Manually activating extension for full coverage");
		try {
			extjsApi = await ext.activate();
		}
		catch (e) {
			assert.fail("Failed to activate extension");
		}
		console.log("         ✔ Extension activated");
	}
	else {
		console.log("         ℹ Extension is already activated, coverage will not occur");
		console.log("         ℹ Remove the activation event from package.json before running tests");
		//
		// Wait for extension to activate
		//
		while (!ext.isActive && wait < maxWait * 10) {
			wait += 1;
			await timeout(100);
		}
		assert(!ext.isActive || wait < maxWait * 10, "Extension did not finish activation within " + maxWait + " seconds");
		//
		// If we could somehow deactivate and reactivate the extension here possibly coverage would work?
		//
		// ext.deactivate();
		//
		// Set extension api exports
		//
		if (!activated) {
			extjsApi = ext.exports;
		}
	}

	assert(extjsApi, "Exported API is empty");
});


test("Wait for Post-Indexing", async function()
{
	this.timeout(10 * 1000);
	await timeout(9000);
});


async function initSettings(enable = true)
{
	// Use update() here for coverage, since these two settings wont trigger any processing
	await configuration.update("debugClient", enable);
	await configuration.update("debugServer", enable);
	await configuration.update("debugLevel", 3);
	await configuration.updateWs("debugClient", enable);
	await configuration.updateWs("debugServer", enable);
	await configuration.updateWs("debugLevel", 3);
}
*/
