
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, waitForValidation } from "./helper";
import { ErrorCode } from "../../../../common";
import { configuration } from "../../common/configuration";
import { ExtJsApi, IExtjsLanguageManager } from "../../extension";


suite("Command Tests", () =>
{
	//
	// NOTE: The 'replaceText' command is used in various other tests, no need for it to
	// get its own test here
	//

	let extJsApi: ExtJsApi;
	let extjsLangMgr: IExtjsLanguageManager;
	const docUri = getDocUri("app/shared/src/app.js");
	let validationDelay: number | undefined;
	let logEnabled: boolean | undefined;
	let ignoreErrors: any[];


	suiteSetup(async () =>
    {
		ignoreErrors = configuration.get<any[]>("ignoreErrors");
		await configuration.update("ignoreErrors", []);
		//
		// Doing some config updates in these tests anyway, so enable logging for coverage
		// of the common/log module.  No need to set a log level, if this is local dev testing
		// then whatever is set already is fine, default is fine
		//
		logEnabled = configuration.get<boolean>("debugClient");
		await configuration.update("debugClient", true);
		//
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250);
		const testsApi = await activate();
		extJsApi = testsApi.extJsApi;
		extjsLangMgr = extJsApi.extjsLangMgr;
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {
		await configuration.update("debugClient", logEnabled);
		await waitForValidation();
		await configuration.update("ignoreErrors", ignoreErrors);
		await waitForValidation();
		await configuration.update("validationDelay", validationDelay || 1250);
		await waitForValidation();
		try {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		}
		catch {}
		await waitForValidation();
	});


	test("Ignore xtype errors", async function()
	{
		if (this && this.timeout) {
			this.timeout(60 * 1000);
		}

		const activeDoc = vscode.window.activeTextEditor?.document;
		//
		// Edge no params shouldexit gracefully w/ no processing
		//
		await testCommand("ignoreError");
		await configuration.update("ignoreErrors", []);
		//
		// File only
		//
		await testCommand("ignoreError", ErrorCode.syntaxAllCaps, activeDoc);
		await waitForValidation();
		//
		// Global
		//
		await testCommand("ignoreError", ErrorCode.syntaxAllCaps);
		await waitForValidation();
		//
		// Xtype
		//
		await testCommand("ignoreError", ErrorCode.xtypeNoRequires, activeDoc);
		await waitForValidation();
		await testCommand("ignoreError", ErrorCode.xtypeNoRequires);
		await waitForValidation();
		await testCommand("ignoreError", ErrorCode.xtypeNotFound, activeDoc);
		await waitForValidation();
		await testCommand("ignoreError", ErrorCode.xtypeNotFound);
		await waitForValidation();
		//
		// Reset (for local tests, this won't matter in a CI environment)
		//
		await configuration.update("ignoreErrors", []);
		await waitForValidation();
	});


	test("Ensure xtype", async () =>
	{
		await testCommand("ensureRequire", "userdropdown"); //  toRange(39, 9, 39, 23));
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:replaceText command to erase the requires array
		// entry we just put in, so that rest of the tests don't fail due to line # shifts !
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(11, 43, 12, 40));
		await waitForValidation();
		//
		// Test a file without an existing requires block
		//
		try {
			const doc = await vscode.workspace.openTextDocument(getDocUri("app/shared/src/main/Main.js"));
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
		await waitForValidation();
		await testCommand("ensureRequire", "userdropdown"); //  toRange(37, 9, 37, 23));
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:replaceText command to erase the requires array
		// entry we just put in, so that rest of the tests don't fail due to line # shifts !
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(8, 4, 11, 0));
		await waitForValidation();

		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		//
		// Test a file that has an xtype ref where the xtype doesnt exist
		//
		try {
			const doc = await vscode.workspace.openTextDocument(getDocUri("app/classic/src/main/BadXType.js"));
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
		await waitForValidation();
		await testCommand("ensureRequire", "comboisnotanywhere"); //  toRange(17, 9, 17, 29));
		await waitForValidation();
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	});


	test("Replace text no-parameter edge case", async () =>
	{
		await testCommand("replaceText", "text");
		await testCommand("replaceText");
	});


	test("Ignore requires errors", async function()
	{
		if (this && this.timeout) {
			this.timeout(45 * 1000);
		}

		await configuration.update("ignoreErrors", []);

		//
		// Requires
		//
		let doc = null;
		try {
			doc = await vscode.workspace.openTextDocument(getDocUri("app/classic/src/main/BadRequire.js"));
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:ignoreError command
		//
		await testCommand("ignoreError", ErrorCode.classNotFound, doc, toRange(12, 9, 12, 45));
		await waitForValidation();
		await testCommand("ignoreError", ErrorCode.classNotFound, doc);
		await waitForValidation();
		await testCommand("ignoreError", "", ErrorCode.classNotFound);
		await waitForValidation();

		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		//
		// Reset (for local tests, this won't matter in a CI environment)
		//
		await configuration.update("ignoreErrors", []);
		await waitForValidation();
	});


	test("Dump cache to files", async () =>
	{
		await testCommand("dumpCache", "testFixture", "");
		await testCommand("dumpCache", "", 1);
		await testCommand("dumpCache", "testFixture");
		await testCommand("dumpCache");
		extjsLangMgr.setBusy(true);
		await testCommand("dumpCache");
		extjsLangMgr.setBusy(false);
		await waitForValidation();
	});


	test("No active document", async () =>
	{
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		await waitForValidation();

		await testCommand("waitReady");
		await testCommand("ignoreError", ErrorCode.classNotFound);
		await testCommand("ignoreError");
		await testCommand("ensureRequire");
		await testCommand("ensureRequire", "physiciandropdown");
		await testCommand("replaceText", "text");
		await testCommand("replaceText");
	});


	test("Re-index files", async () =>
	{
		await testCommand("indexFiles");
		await waitForValidation();
		await testCommand("waitReady");
	});


	test("Wait-Ready variations", async () =>
	{
		await testCommand("waitReady");
		await testCommand("waitReady", "   ");
		await testCommand("waitReady", "   ", 1000);
	});

});


async function testCommand(command: string, ...args: any[])
{
		await vscode.commands.executeCommand("vscode-extjs:" + command, ...args);
		await waitForValidation();
}
