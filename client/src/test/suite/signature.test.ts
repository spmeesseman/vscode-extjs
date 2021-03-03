
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, waitForValidation } from "./helper";


suite("Method Signature Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let quickSuggest: boolean | undefined;


	suiteSetup(async () =>
    {
		await activate(docUri);
	});


	// test("Local methods", async () =>
	// {
	// 	await testSignature(docUri, new vscode.Position(95, 8), {
	// 		activeParameter: 0,
	// 		activeSignature: 0,
	// 		signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
	// 	});
	// });


	test("Class methods", async () =>
	{
		//
		// Line 71
		// VSCodeExtJS.AppUtilities.alertError
		//
		await testSignature(docUri, new vscode.Position(71, 38), {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
		});
	});


	// test("Inherited methods", async () =>
	// {
	// 	//
	// 	// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
	// 	// Line 83
	// 	// phys.*
	// 	//
	// 	await testSignature(docUri, new vscode.Position(82, 7), {
	// 		activeParameter: 0,
	// 		activeSignature: 0,
	// 		signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
	// 	});
	// });

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


async function testSignature(docUri: vscode.Uri, position: vscode.Position, expectedSignatureHelp: vscode.SignatureHelp)
{
	const actualSignatureHelp = (await vscode.commands.executeCommand(
		"vscode.executeSignatureHelpProvider",
		docUri,
		position,
		"("
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
