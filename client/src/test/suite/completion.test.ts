
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, waitForValidation } from "./helper";
import { assertTSConstructSignatureDeclaration } from "@babel/types";


suite("Completion Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let quickSuggest: boolean | undefined;


	suiteSetup(async () =>
    {
		await activate(docUri);
		const config = vscode.workspace.getConfiguration();
		quickSuggest = config.get<boolean>("editor.quickSuggestions");
		await config.update("editor.quickSuggestions", false);
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {
		await vscode.workspace.getConfiguration().update("editor.quickSuggestions", quickSuggest);
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
	});


	test("Inline property start", async () =>
	{
		//
		// Inside function
		//
		await testCompletion(docUri, new vscode.Position(95, 8), "", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class },
				{ label: "Utils", kind: vscode.CompletionItemKind.Class },
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		});

		//
		// Inside function - beginning of line
		//
		await testCompletion(docUri, new vscode.Position(95, 1), "", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		});

		//
		// Outside function 0 results
		//
		await testCompletion(docUri, new vscode.Position(97, 0), "", {
			items: []
		});
	});


	test("This methods", async () =>
	{
		//
		// Line 71
		// this.*
		//
		await testCompletion(docUri, new vscode.Position(70, 7), ".", {
			items: [
				{ label: "setTest", kind: vscode.CompletionItemKind.Method },
				{ label: "getTest", kind: vscode.CompletionItemKind.Method },
				{ label: "test", kind: vscode.CompletionItemKind.Property }
			]
		});
	});


	test("Local inherited methods", async () =>
	{
		//
		// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
		// Line 83
		// phys.*
		//
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "save", kind: vscode.CompletionItemKind.Method },
				{ label: "load", kind: vscode.CompletionItemKind.Method },
				{ label: "delete", kind: vscode.CompletionItemKind.Method }
			]
		});
	});


	test("Local methods", async () =>
	{
		//
		// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
		// Line 83
		// phys.*
		//
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPinNumber", kind: vscode.CompletionItemKind.Method },
				{ label: "getPin", kind: vscode.CompletionItemKind.Method }
			]
		});
	});


	test("Sub-classes", async () =>
	{
		//
		// Line 75-76
		// VSCodeExtJS.*
		//
		await testCompletion(docUri, new vscode.Position(74, 14), ".", {
			items: [
				{ label: "common", kind: vscode.CompletionItemKind.Class },
				{ label: "AppUtilities", kind: vscode.CompletionItemKind.Class }
			]
		});

		//
		// Line 72
		// VSCodeExtJS.AppUtilities.*
		//
		await testCompletion(docUri, new vscode.Position(71, 27), ".", {
			items: [
				{ label: "alertError", kind: vscode.CompletionItemKind.Method }
			]
		});

		//
		// Line 75-76
		// VSCodeExtJS.common.*
		//
		await testCompletion(docUri, new vscode.Position(74, 21), ".", {
			items: [
				{ label: "PhysicianDropdown", kind: vscode.CompletionItemKind.Class },
				{ label: "UserDropdown", kind: vscode.CompletionItemKind.Class }
			]
		});
	});


	test("Sub-class methods", async () =>
	{
		//
		// Line 72
		// VSCodeExtJS.AppUtilities.*
		//
		await testCompletion(docUri, new vscode.Position(71, 27), ".", {
			items: [
				{ label: "alertError", kind: vscode.CompletionItemKind.Method }
			]
		});
	});


	test("Full xtype lines", async () =>
	{
		//
		// Line 121-124
		// const patient = Ext.create('VSCodeExtJS.common.PatientDropdown', {
		//
		// });
		//
		await testCompletion(docUri, new vscode.Position(121, 3), "x", {
			items: [
				{ label: "xtype: component", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: grid", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: gridpanel", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: patientdropdown", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: physiciandropdown", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: userdropdown", kind: vscode.CompletionItemKind.Property }
			]
		});
	});

});


async function testCompletion(docUri: vscode.Uri, position: vscode.Position, triggerChar: string, expectedCompletionList: vscode.CompletionList)
{
	const actualCompletionList = (await vscode.commands.executeCommand(
		"vscode.executeCompletionItemProvider",
		docUri,
		position,
		triggerChar
	)) as vscode.CompletionList;

	// actualCompletionList.items.forEach((actualItem, i) => {
	// 	// const actualItem = actualCompletionList.items[i];
	// 	// assert.equal(actualItem.label, expectedItem.label);
	// 	// assert.equal(actualItem.kind, expectedItem.kind);
	// 	if (triggerChar && actualItem.kind) {
	// 		console.log(actualItem.label, actualItem.kind ? vscode.CompletionItemKind[actualItem.kind] : "");
	// 	}
	// });

	assert.ok(actualCompletionList.items.length >= expectedCompletionList.items.length);

	expectedCompletionList.items.forEach((expectedItem, i) => {
		assert.strictEqual(actualCompletionList.items.filter(
			item => (item.label === expectedItem.label || item.insertText === expectedItem.label) && item.kind === expectedItem.kind).length,
			1, expectedItem.label + " not found"
		);
	});
}
