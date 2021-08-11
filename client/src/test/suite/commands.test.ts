
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, sleep, waitForValidation } from "./helper";
import { ErrorCode } from "../../../../common";
import { configuration } from "../../common/configuration";


suite("Command Tests", () =>
{
	//
	// NOTE: The 'replaceText' command is used in various other tests, no need for it to
	// get its own test here
	//

	const docUri = getDocUri("app/shared/src/app.js");
	let validationDelay: number | undefined;
	let logEnabled: boolean | undefined;


	suiteSetup(async () =>
    {
		await activate(docUri);
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
	});


	suiteTeardown(async () =>
    {
		await configuration.update("validationDelay", validationDelay || undefined);
		await configuration.update("debugClient", logEnabled);
	});


	test("Ignore error", async () =>
	{
		//
		// Edge no params shouldexit gracefully w/ no processing
		//
		await testCommand("ignoreError");
		//
		// For local dev environment test, read the ignoreErrors setting so that it can be restored
		// when the tests are finished, since "Ignore error" test will set this via vscode command
		//
		const ignoreErrors = configuration.get<any[]>("ignoreErrors");
		//
		// File only
		//
		await testCommand("ignoreError", ErrorCode.syntaxAllCaps, docUri.fsPath);
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// Global
		//
		await testCommand("ignoreError", ErrorCode.syntaxAllCaps);
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// Reset (for local tests, this won't matter in a CI environment)
		//
		await configuration.update("ignoreErrors", ignoreErrors);
		//
		// Wait again for validation (debounce is 250ms)
		//
		await waitForValidation();

	});


	test("Ensure xtype", async () =>
	{
		await testCommand("ensureRequire", "userdropdown"); //  toRange(39, 9, 39, 23));
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:replaceText command to erase the requires array
		// entry we just put in, so that rest of the tests don't fail due to line # shifts !
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(11, 43, 12, 40));
		//
		// Wait again for validation (debounce is 250ms)
		//
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
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		await testCommand("ensureRequire", "userdropdown"); //  toRange(37, 9, 39, 23));
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:replaceText command to erase the requires array
		// entry we just put in, so that rest of the tests don't fail due to line # shifts !
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(8, 4, 11, 0));
		//
		// Wait again for validation (debounce is 250ms)
		//
		await waitForValidation();
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	});


	test("Replace text no-parameter edge case", async () =>
	{
		await testCommand("replaceText", "text");
		await testCommand("replaceText");
	});


	test("Re-index files", async () =>
	{
		await testCommand("indexFiles");
		//
		// Wait for validation
		//
		await waitForValidation();
	});

});


async function testCommand(command: string, ...args: any[])
{
		await vscode.commands.executeCommand("vscode-extjs:" + command, ...args);
		//
		// Wait again for validation (debounce is 250ms)
		//
		await waitForValidation();
}
