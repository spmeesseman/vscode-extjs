
import * as vscode from "vscode";
import * as assert from "assert";
import { configuration } from "../../common/configuration";
import { getDocUri, activate, insertDocContent, toRange, waitForValidation } from "./helper";


suite("Method Signature Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {
		await activate(docUri);
		//
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("validationDelay", validationDelay || undefined);
	});


	test("Class methods", async () =>
	{
		//
		// Line 71
		// VSCodeExtJS.AppUtilities.alertError
		//
		await testSignature(docUri, new vscode.Position(71, 38), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
		});

		//
		// Insert a first parameter, and trigger the signature helper again, we should then be
		// on parameter #2...
		//
		await insertDocContent("\"me\",", toRange(71, 38, 71, 38));
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();

		await testSignature(docUri, new vscode.Position(71, 43), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
		});

		await insertDocContent("", toRange(71, 38, 71, 43));
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
	});


	test("Multi Inline method call", async () =>
	{
		//
		// Line 109
		// me.testFn2();
		// Insert a first parameter that will be a function call
		//
		await insertDocContent("me.testFn4()", toRange(108, 13, 108, 13));
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// Line 109
		// me.testFn2(me.testFn4(...
		//
		await testSignature(docUri, new vscode.Position(108, 24), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		});
		//
		// Insert a first parameter, and trigger the signature helper again, we should then be
		// on parameter #2...
		//
		await insertDocContent("\"me\",", toRange(108, 24, 108, 24));
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// 2nd parameter
		//
		await testSignature(docUri, new vscode.Position(108, 29), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		});
		//
		// Remove added text, set document back to initial state
		//
		await insertDocContent("", toRange(108, 13, 108, 30));
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
	});

});


function getSigInfo(sigLine: string): vscode.SignatureInformation[]
{
	const sigInfo = new vscode.SignatureInformation(sigLine),
		  params = sigLine.split(",");
	for (const p of params)
	{
		sigInfo.parameters.push(new vscode.ParameterInformation(p.trim()));
	}
	return [ sigInfo ];
}


async function testSignature(docUri: vscode.Uri, position: vscode.Position, triggerChar: string, expectedSignatureHelp: vscode.SignatureHelp)
{
	const actualSignatureHelp = (await vscode.commands.executeCommand(
		"vscode.executeSignatureHelpProvider",
		docUri,
		position,
		triggerChar
	)) as vscode.SignatureHelp;

	assert.ok(actualSignatureHelp.signatures.length === expectedSignatureHelp.signatures.length);
	assert.ok(actualSignatureHelp.activeParameter === expectedSignatureHelp.activeParameter);
	assert.ok(actualSignatureHelp.activeSignature === expectedSignatureHelp.activeSignature);

	expectedSignatureHelp.signatures.forEach((expectedItem, i) =>
	{
		const actualItem = actualSignatureHelp.signatures[i];
		assert.ok(actualItem.parameters.length === expectedItem.parameters.length);
		expectedItem.parameters.forEach((expectedParam, j) =>
		{
			const actualParam = actualItem.parameters[j];
			assert.ok(actualParam.label === expectedParam.label);
		});
	});
}
