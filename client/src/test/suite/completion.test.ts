
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, waitForValidation } from "./helper";
import { configuration } from "../../common/configuration";


suite("Completion Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let quickSuggest: boolean | undefined;
	let ignoreErrors: any[];


	suiteSetup(async () =>
    {
		const config = vscode.workspace.getConfiguration();
		quickSuggest = config.get<boolean>("editor.quickSuggestions");
		await config.update("editor.quickSuggestions", false);
		ignoreErrors = configuration.get<any[]>("ignoreErrors", []);
		await configuration.update("ignoreErrors", []);
		await activate(docUri);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {
		await vscode.workspace.getConfiguration().update("editor.quickSuggestions", quickSuggest);
		await configuration.update("ignoreErrors", ignoreErrors);
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
		// Inside method callee expression (parameter)
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
		// Inside object - 'u' trigger
		// Line 121-123
		// const phys = Ext.create('VSCodeExtJS.common.PatientDropdown', {
		//
		// });
		//
		await testCompletion(docUri, new vscode.Position(121, 3), "u", {
			items: [
				{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
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
				{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property },
				{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property }
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
				{ label: "setTest config setter", kind: vscode.CompletionItemKind.Method },
				{ label: "getTest config getter", kind: vscode.CompletionItemKind.Method },
				{ label: "test config", kind: vscode.CompletionItemKind.Property },
				{ label: "test2 config", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "this methods");
	});


	test("Local inherited methods", async () =>
	{
		const incDeprecated = configuration.get<boolean>("intellisenseIncludeDeprecated");
		await configuration.update("intellisenseIncludeDeprecated", true);
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

		await configuration.update("intellisenseIncludeDeprecated", false);
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method }
			]
		}, false);

		await configuration.update("intellisenseIncludeDeprecated", incDeprecated);
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
				{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
			]
		}, false);
		await configuration.update("intellisenseIncludePrivate", true);
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method },
				// { label: "getPinNumberInternal (private)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
			]
		});
		await configuration.update("intellisenseIncludeDeprecated", incDeprecated);
		await configuration.update("intellisenseIncludePrivate", incPrivate);
	});


	test("Static properties and methods", async () =>
	{
		//
		// Line 193
		// VSCodeExtJS.common.PhysicianDropdown.saveAll
		//
		await testCompletion(docUri, new vscode.Position(192, 38), ".", {
			items: [
				{ label: "stopAll (static) (since v1.3.0)", kind: vscode.CompletionItemKind.Method },
				{ label: "staticVariable (static)", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "static properties and methods");
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
		}, true, "middle classpath inline");

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
				{ label: "UserDropdown (since v1.0.0)", kind: vscode.CompletionItemKind.Class }
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
		const quoteCharacter = configuration.get<string>("quoteCharacter", "single");
		await configuration.update("quoteCharacter", "single");
		//
		// Line 187 - 191
		// const grid = Ext.create({
		//	   hidden: false,
		//	   disabled: true,
		//
		// });
		//
		await testCompletion(docUri, new vscode.Position(189, 3), "x", {
			items: [
				{ label: "xtype: component", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: grid", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: gridpanel", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: patientdropdown", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: physiciandropdown", kind: vscode.CompletionItemKind.Property },
				{ label: "xtype: userdropdown", kind: vscode.CompletionItemKind.Property }
			]
		});
		//
		// Line 121-123 - should return nothing, since the component is defined
		// in the 1st argument to Ext.create
		//
		// const patient = Ext.create('VSCodeExtJS.common.PatientDropdown', {
		//
		// });
		//
		await testCompletion(docUri, new vscode.Position(121, 3), "x", {
			items: []
		});

		await configuration.update("quoteCharacter", quoteCharacter);
	});


	test("Class object configs and properties", async () =>
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
				{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
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
				{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
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
				{ label: "userName config", kind: vscode.CompletionItemKind.Property }
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
				{ label: "maxHeight Component config", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(181, 3), "m", {
			items: [
				{ label: "maxHeight Component config", kind: vscode.CompletionItemKind.Property }
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
				{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
			]
		});
		await testCompletion(docUri, new vscode.Position(158, 3), "r", {
			items: [
				{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property },
			]
		});
	});

});


async function testCompletion(docUri: vscode.Uri, position: vscode.Position, triggerChar: string, expectedCompletionList: vscode.CompletionList, shouldShow = true, testDesc?: string)
{

	const actualCompletionList = (await vscode.commands.executeCommand(
		"vscode.executeCompletionItemProvider",
		docUri,
		position,
		triggerChar
	)) as vscode.CompletionList;

	// const logKind = "Method";
	// const logDesc = "static properties and methods";
	// if (testDesc === logDesc)
	// {
	// 	console.log("####################################");
	// 	console.log(docUri.path);
	// 	console.log("actual items length", actualCompletionList.items.length);
	// 	console.log("expected items length", expectedCompletionList.items.length);
	// 	console.log("####################################");
	// 	actualCompletionList.items.forEach((actualItem) => {
	// 		if (triggerChar) { // && actualItem.kind && vscode.CompletionItemKind[actualItem.kind] === logKind) {
	// 			console.log(actualItem.label, actualItem.kind ? vscode.CompletionItemKind[actualItem.kind] : "");
	// 		}
	// 	});
	// }

	assert.ok(actualCompletionList.items.length >= expectedCompletionList.items.length);

	expectedCompletionList.items.forEach((expectedItem, i) => {
		assert.strictEqual(
			actualCompletionList.items.filter((item) =>
			{
				return item.kind === expectedItem.kind && (item.label.replace(/ /g, "") === expectedItem.label.replace(/ /g, "") ||
						item.insertText?.toString().replace(/ /g, "") === expectedItem.insertText?.toString().replace(/ /g, ""));
			}).length, shouldShow ? 1 : 0, expectedItem.label + " not found" + (testDesc ? ` (${testDesc})` : "")
		);
	});
}
