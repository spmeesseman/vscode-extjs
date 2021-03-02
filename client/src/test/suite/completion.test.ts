
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, sleep, doc, editor, toRange } from "./helper";


suite("Completion Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
	});


	test("Inline property start", async () =>
	{
		await testCompletion(docUri, new vscode.Position(95, 8), "", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class },
				{ label: "Utils", kind: vscode.CompletionItemKind.Class },
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
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

});


async function testCompletion(docUri: vscode.Uri, position: vscode.Position, triggerChar: string, expectedCompletionList: vscode.CompletionList)
{
	const config = vscode.workspace.getConfiguration(),
		  quickSuggest = config.get<boolean>("editor.quickSuggestions");

	await config.update("editor.quickSuggestions", false);

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
		assert.strictEqual(actualCompletionList.items.filter(item => (item.label === expectedItem.label || item.insertText === expectedItem.label) && item.kind === expectedItem.kind).length, 1, expectedItem.label + " not found");
	});

	await vscode.workspace.getConfiguration().update("editor.quickSuggestions", quickSuggest);
}
