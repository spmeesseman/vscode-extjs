
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


	suiteSetup(async () =>
    {
		await activate(docUri);
		//
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250);
	});


	suiteTeardown(async () =>
    {
		await configuration.update("validationDelay", validationDelay || undefined);
	});


	test("Ignore error", async () =>
	{   //
		// For local dev environment test, read the ignoreErrors setting so that it can be restored
		// when the tests are finished, since "Ignore error" test will set this via vscode command
		//
		const ignoreErrors = configuration.get<any[]>("ignoreErrors");
		//
		// File only
		//
		testCommand("ignoreError", ErrorCode.syntaxAllCaps, docUri.fsPath);
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// Global
		//
		testCommand("ignoreError", ErrorCode.syntaxAllCaps);
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
		testCommand("ensureRequire", "userdropdown"); //  toRange(39, 9, 39, 23));
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:replaceText command to erase the requires array
		// entry we just put in, so that rest of the tests dont fail due to line # shifts !
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(11, 43, 12, 40));
		//
		// Wait again for validation (debounce is 250ms)
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
