
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, waitForValidation } from "./helper";
import { configuration } from "../../common/configuration";
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


	test("class object configs and properties", async () =>
	{   //
		// Line 167
		// Within main object
		// dockedItems: [
		// {
		//     xtype: "physiciandropdown"
		// }...
		//
		await testCompletion(docUri, new vscode.Position(166, 3), "u", {
			items: [
				{ label: "userName UserDropdown Config", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(166, 3), "r", {
			items: [
				{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property },
			]
		});

		//
		// And 171 for patientdropdown
		//
		await testCompletion(docUri, new vscode.Position(170, 3), "u", {
			items: [
				{ label: "userName UserDropdown Config", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(170, 3), "r", {
			items: [
				{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property },
			]
		});

		//
		// And 175 for userdropdown (props are defined on userdropdown, not inherited)
		//
		await testCompletion(docUri, new vscode.Position(174, 3), "u", {
			items: [
				{ label: "userName Config", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(174, 3), "r", {
			items: [
				{ label: "readOnly", kind: vscode.CompletionItemKind.Property },
			]
		});

		//
		// And 182 for an ExtJs component 'textfield'
		//
		await testCompletion(docUri, new vscode.Position(181, 3), "a", {
			items: [
				{ label: "allowBlank", kind: vscode.CompletionItemKind.Property },
				{ label: "maxHeight Component Config", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(181, 3), "m", {
			items: [
				{ label: "maxHeight Component Config", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(181, 3), "f", {
			items: [
				{ label: "fieldBodyCls", kind: vscode.CompletionItemKind.Property },
				{ label: "fieldCls Base", kind: vscode.CompletionItemKind.Property },
				{ label: "rawToValue Base", kind: vscode.CompletionItemKind.Property }
				//
				// TODO - Mixin properties (e.g. Ext.form.field.Labelable - fieldLabel)
				//
				// { label: "fieldLabel", kind: vscode.CompletionItemKind.Property }
			]
		});

		//
		// Line 121-123
		// Within a function body
		// const patient = Ext.create('VSCodeExtJS.common.PatientDropdown', {
		//    ...typing here should give 'userName' config and 'readOnly' property,
		//    ...inherited from UserDropdown
		// });
		//
		await testCompletion(docUri, new vscode.Position(158, 3), "u", {
			items: [
				{ label: "userName UserDropdown Config", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(158, 3), "r", {
			items: [
				{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property },
			]
		});
	});

});


async function testCompletion(docUri: vscode.Uri, position: vscode.Position, triggerChar: string, expectedCompletionList: vscode.CompletionList, shouldShow = true)
{
	const actualCompletionList = (await vscode.commands.executeCommand(
		"vscode.executeCompletionItemProvider",
		docUri,
		position,
		triggerChar
	)) as vscode.CompletionList;

	// console.log("####################################");
	// console.log(docUri.path);
	// console.log("actual items length", actualCompletionList.items.length);
	// console.log("expected items length", expectedCompletionList.items.length);
	// console.log("####################################");
	// let ct = 0;
	// actualCompletionList.items.forEach((actualItem, i) => {
	// 	// const actualItem = actualCompletionList.items[i];
	// 	// assert.equal(actualItem.label, expectedItem.label);
	// 	// assert.equal(actualItem.kind, expectedItem.kind);
	// 	if (triggerChar && actualItem.kind && vscode.CompletionItemKind[actualItem.kind] === "Property") {
	// 		console.log(actualItem.label, actualItem.kind ? vscode.CompletionItemKind[actualItem.kind] : "");
	// 	}
	// 	if (++ct > 50) {
	// 		return false; // break forEach
	// 	}
	// });

	assert.ok(actualCompletionList.items.length >= expectedCompletionList.items.length);

	expectedCompletionList.items.forEach((expectedItem, i) => {
		assert.strictEqual(
			actualCompletionList.items.filter((item) =>
			{
				return item.kind === expectedItem.kind && (item.label.replace(/ /g, "") === expectedItem.label.replace(/ /g, "") ||
						item.insertText?.toString().replace(/ /g, "") === expectedItem.label.replace(/ /g, ""));
			}).length, shouldShow ? 1 : 0, expectedItem.label + " not found"
		);
	});
}
