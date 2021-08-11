
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

		//
		// Inside method calle expression (parameter)
		// Line 75
		// VSCodeExtJS.common.PhysicianDropdown.create()
		// Inside create() i.e. create( ... )
		//
		await testCompletion(docUri, new vscode.Position(74, 46), "", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class },
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class },
				{ label: "Utils", kind: vscode.CompletionItemKind.Class },
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		});
		await testCompletion(docUri, new vscode.Position(74, 46), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		});

		//
		// Inside object
		// Line 124-126
		// const phys = Ext.create('VSCodeExtJS.common.PhysicianDropdown', {
		//
		// });
		//
		await testCompletion(docUri, new vscode.Position(124, 3), "", {
			items: [
				{ label: "userName UserDropdown Config", kind: vscode.CompletionItemKind.Property },
				{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(124, 3), "u", {
			items: [
				{ label: "userName UserDropdown Config", kind: vscode.CompletionItemKind.Property }
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
				{ label: "test Config", kind: vscode.CompletionItemKind.Property },
				{ label: "test2 Config", kind: vscode.CompletionItemKind.Property }
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
				{ label: "delete", kind: vscode.CompletionItemKind.Method },
				{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method }
			]
		});
	});


	test("Local class instances", async () =>
	{
		const incDeprecated = configuration.get<boolean>("intellisenseIncludeDeprecated"),
			  incPrivate = configuration.get<boolean>("intellisenseIncludePrivate");
		//
		// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
		// Line 83
		// phys.*
		//
		await configuration.update("intellisenseIncludeDeprecated", false);
		await configuration.update("intellisenseIncludePrivate", false);
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method }
			]
		});
		await configuration.update("intellisenseIncludeDeprecated", true);
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method }
			]
		});
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPinNumberInternal", kind: vscode.CompletionItemKind.Method }
			]
		}, false);
		await configuration.update("intellisenseIncludePrivate", true);
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method },
				// { label: "getPinNumberInternal (private)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPinNumberInternal", kind: vscode.CompletionItemKind.Method }
			]
		});
		await configuration.update("intellisenseIncludeDeprecated", incDeprecated);
		await configuration.update("intellisenseIncludePrivate", incPrivate);
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
		// Line 121-123
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
