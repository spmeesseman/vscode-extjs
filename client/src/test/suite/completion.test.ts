/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, sleep, doc, editor } from "./helper";


suite("Completion Tests", () =>
{
	const docUri = getDocUri("app/shared/src/app.js");

	test("Inline property start", async () =>
	{
		await testCompletion(docUri, new vscode.Position(94, 8), {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class },
				{ label: "Utils", kind: vscode.CompletionItemKind.Class },
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		});
	});
});


async function testCompletion(docUri: vscode.Uri, position: vscode.Position, expectedCompletionList: vscode.CompletionList)
{
	await activate(docUri);

	const config = vscode.workspace.getConfiguration(),
		  quickSuggest = config.get<boolean>("editor.quickSuggestions");

	await config.update("editor.quickSuggestions", false);
	//
	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
	//

	// const workspaceEdit = new vscode.WorkspaceEdit();
	// const range = new vscode.Range(position, position);
	// workspaceEdit.replace(docUri, range, "A");
	// vscode.workspace.applyEdit(workspaceEdit);

	const triggerChars = [
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
        "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
        "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "_", "."
    ];

	const newPosition = new vscode.Position(position.line, position.character + 1);
	const actualCompletionList = (await vscode.commands.executeCommand(
		"vscode.executeCompletionItemProvider",
		docUri,
		newPosition
	)) as vscode.CompletionList;

	assert.ok(actualCompletionList.items.length >= expectedCompletionList.items.length);

	expectedCompletionList.items.forEach((expectedItem, i) => {
		assert.strictEqual(actualCompletionList.items.filter(item => item.label === expectedItem.label && item.kind === expectedItem.kind).length, 1, expectedItem.label + " not found");
	});

	// actualCompletionList.items.forEach((actualItem, i) => {
	// 	// const actualItem = actualCompletionList.items[i];
	// 	// assert.equal(actualItem.label, expectedItem.label);
	// 	// assert.equal(actualItem.kind, expectedItem.kind);
	// 	console.log(actualItem.label, actualItem.kind ? vscode.CompletionItemKind[actualItem.kind] : "");
	// });

	await vscode.workspace.getConfiguration().update("editor.quickSuggestions", quickSuggest);
}
