
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, waitForValidation } from "./helper";
import { configuration } from "../../common/configuration";


suite("Diagnostics Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let ignoreErrors: any[] | undefined;


	suiteSetup(async () =>
    {
		await activate(docUri);
		//
		// For local dev environment test, make sure the ignore setting is undefined
		//
		ignoreErrors = configuration.get<any[]>("ignoreErrors");
		await configuration.update("ignoreErrors", undefined);
		//
		// Wait again for validation (debounce is 250ms)
		//
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {
		await configuration.update("ignoreErrors", ignoreErrors);
	});


	test("Diagnose uppercase texts", async () =>
	{
		//
		//
		//
		await testDiagnostics(docUri, "is all uppercase", [
			{ message: "CCC is all uppercase.", range: toRange(66, 0, 66, 3), severity: vscode.DiagnosticSeverity.Warning, source: "vscode-extjs" }
		]);
	});


	test("Diagnose xtypes", async () =>
	{
		await testDiagnostics(docUri, "The referenced xtype", [
			{ message: "The referenced xtype \"patieuntdropdown\" was not found.", range: toRange(36, 9, 36, 27), severity: vscode.DiagnosticSeverity.Error, source: "vscode-extjs" },
			{ message: "The referenced xtype \"userdropdown\" does not have a corresponding requires directive.", range: toRange(39, 9, 39, 23), severity: vscode.DiagnosticSeverity.Warning, source: "vscode-extjs" }
		]);
	});

});


async function testDiagnostics(docUri: vscode.Uri, msgFilter: string, expectedDiagnostics: vscode.Diagnostic[])
{
	const actualDiagnostics = vscode.languages.getDiagnostics(docUri).filter(item => item.message.indexOf(msgFilter) !== -1);

	assert.strictEqual(actualDiagnostics.length, expectedDiagnostics.length, "Expected # of diagnostics not found: " + msgFilter);

	expectedDiagnostics.forEach((expectedDiagnostic, i) => {
		const actualDiagnostic = actualDiagnostics[i];
		assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message);
		assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range);
		assert.strictEqual(actualDiagnostic.severity, expectedDiagnostic.severity);
	});
}
