
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, waitForValidation, closeActiveDocuments, closeActiveDocument } from "./helper";
import { ErrorCode } from "../../../../common";
import { configuration } from "../../common/configuration";
import { ExtJsApi, IExtjsLanguageManager } from "../../common/interface";


suite("Command Tests", () =>
{
	//
	// NOTE: The 'replaceText' command is used in various other tests, no need for it to
	// get its own test here
	//

	let extJsApi: ExtJsApi;
	let extjsLangMgr: IExtjsLanguageManager;
	const docUri = getDocUri("app/shared/src/app.js");
	let logEnabled: boolean | undefined;
	let ignoreErrors: any[];


	suiteSetup(async function()
    {
		const testsApi = await activate(docUri);
		extJsApi = testsApi.extJsApi;
		extjsLangMgr = extJsApi.extjsLangMgr;
		ignoreErrors = configuration.get<any[]>("ignoreErrors");
		await configuration.update("ignoreErrors", []);
		//
		// Doing some config updates in these tests anyway, so enable logging for coverage
		// of the common/log module.  No need to set a log level, if this is local dev testing
		// then whatever is set already is fine, default is fine
		//
		logEnabled = configuration.get<boolean>("debugClient");
		await configuration.update("debugClient", true);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {
		await configuration.update("debugClient", logEnabled);
		await waitForValidation();
		await configuration.update("ignoreErrors", ignoreErrors);
		await waitForValidation();
		await closeActiveDocuments();
	});


	test("Ignore xtype errors", async function()
	{
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
		//
		// Global
		//
		await testCommand("ignoreError", ErrorCode.syntaxAllCaps);
		//
		// Xtype
		//
		await testCommand("ignoreError", ErrorCode.xtypeNoRequires, activeDoc);
		await testCommand("ignoreError", ErrorCode.xtypeNoRequires);
		await testCommand("ignoreError", ErrorCode.xtypeNotFound, activeDoc);
		await testCommand("ignoreError", ErrorCode.xtypeNotFound);
		//
		// Reset (for local tests, this won't matter in a CI environment)
		//
		await configuration.update("ignoreErrors", []);
		await waitForValidation();
	});


	test("Ensure xtype", async () =>
	{
		await testCommand("ensureRequire", "userdropdown", "xtype"); //  toRange(39, 9, 39, 23));
		//
		// Use the extension's vscode-extjs:replaceText command to erase the requires array
		// entry we just put in, so that rest of the tests don't fail due to line # shifts !
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(11, 43, 12, 40));
		await waitForValidation();
		//
		// Test a file without an existing requires block
		//
		await activate(getDocUri("app/shared/src/main/Main.js"));
		await testCommand("ensureRequire", "userdropdown", "xtype"); //  toRange(37, 9, 37, 23));
		//
		// Use the extension's vscode-extjs:replaceText command to erase the requires array
		// entry we just put in, so that rest of the tests don't fail due to line # shifts !
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(8, 4, 11, 0));
		await waitForValidation();

		await closeActiveDocument();
		//
		// Test a file that has an xtype ref where the xtype doesnt exist
		//
		await activate(getDocUri("app/classic/src/main/BadXType.js"));
		await testCommand("ensureRequire", "comboisnotanywhere"); //  toRange(17, 9, 17, 29));

		await closeActiveDocument();
	});


	test("Ensure type", async () =>
	{
		await testCommand("ensureRequire", "users", "type"); //  toRange(39, 9, 39, 23));
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	});


	test("Ignore requires errors", async () =>
	{	//
		// Set configuration for this test
		//
		await configuration.update("ignoreErrors", []);
		//
		// Requires
		//
		const doc = await activate(getDocUri("app/classic/src/main/BadRequire.js"));
		//
		// Use the extension's vscode-extjs:ignoreError command
		//
		await testCommand("ignoreError", ErrorCode.classNotFound, doc.doc, toRange(12, 9, 12, 45));
		//
		// By document/file
		//
		await testCommand("ignoreError", ErrorCode.classNotFound, doc.doc);
		//
		// Global
		//
		await testCommand("ignoreError", ErrorCode.classNotFound);
		//
		// Global already exists
		//
		await testCommand("ignoreError", ErrorCode.classError);
		await testCommand("ignoreError", ErrorCode.classError);
		await testCommand("ignoreError", ErrorCode.classNotFound, doc.doc);
		await testCommand("ignoreError", ErrorCode.classNotFound, doc.doc);
		//
		// CLose active editor
		//
		await closeActiveDocument();
		//
		// Reset configuration
		//
		await configuration.update("ignoreErrors", []);
		await waitForValidation();
	});


	test("Dump cache to files", async function()
	{
		await testCommand("dumpCache", "testFixture", "");
		await closeActiveDocuments();
		await testCommand("dumpCache", "", 1);
		await closeActiveDocuments();
		await testCommand("dumpCache", "testFixture");
		await closeActiveDocuments();
		await testCommand("dumpCache");
		await closeActiveDocuments();
		extjsLangMgr.setBusy(true);
		await vscode.commands.executeCommand("vscode-extjs:dumpCache");
		await waitForValidation(false);
		await waitForValidation(false);
		await closeActiveDocuments();
		extjsLangMgr.setBusy(false);
		await waitForValidation();
	});


	test("No active document", async () =>
	{
		await testCommand("waitReady");
		await testCommand("ignoreError", ErrorCode.classNotFound);
		await testCommand("ignoreError");
		await testCommand("ensureRequire");
		await testCommand("ensureRequire", "physiciandropdown", "xtype");
		await testCommand("ensureRequire", "users", "type");
	});


	test("Non-extjs document", async function()
	{
		await activate(getDocUri("app/js/script1.js"));
		await testCommand("ignoreError", ErrorCode.classNotFound);
		await testCommand("ignoreError");
		await testCommand("ensureRequire", "physiciandropdown", "xtype");
		await testCommand("ensureRequire", "users", "type");
		await closeActiveDocument();
		await waitForValidation();
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
		await waitForValidation(false);
}
