
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, waitForValidation, insertDocContent, toRange } from "./helper";
import { configuration } from "../../common/configuration";


suite("Completion Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let quickSuggest: boolean | undefined;
	let ignoreErrors: any[];
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {
		const config = vscode.workspace.getConfiguration();
		//
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
		await waitForValidation();
		//
		// Set `quick suggest` setting
		//
		quickSuggest = config.get<boolean>("editor.quickSuggestions");
		await config.update("editor.quickSuggestions", true);
		await waitForValidation();
		//
		// Set `ignore errors` setting
		//
		ignoreErrors = configuration.get<any[]>("ignoreErrors", []);
		await configuration.update("ignoreErrors", []);
		await waitForValidation();
		//
		// Open default test document
		//
		await activate(docUri);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {   //
		// Reset `quick suggest` setting
		//
		await vscode.workspace.getConfiguration().update("editor.quickSuggestions", quickSuggest);
		await waitForValidation();
		//
		// Reset `ignore errors` setting
		//
		await configuration.update("ignoreErrors", ignoreErrors);
		await waitForValidation();
		//
		// Reset `validation delay` setting
		//
		await configuration.update("validationDelay", validationDelay || 1250);
		await waitForValidation();
		//
		// Close active document
		//
		try {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		}
		catch {}
		await waitForValidation();
	});


	test("Inline property start", async () =>
	{
		//
		// Inside function
		//
		await testCompletion(docUri, new vscode.Position(95, 3), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start A");

		await testCompletion(docUri, new vscode.Position(95, 3), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start");

		await testCompletion(docUri, new vscode.Position(95, 3), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start");

		await testCompletion(docUri, new vscode.Position(95, 3), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline property start");

		//
		// Inside function - beginning of line
		//
		await testCompletion(docUri, new vscode.Position(95, 0), "U", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		});
		await testCompletion(docUri, new vscode.Position(95, 0), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class }
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
		await testCompletion(docUri, new vscode.Position(74, 46), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		});
		await testCompletion(docUri, new vscode.Position(74, 46), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		});
		await testCompletion(docUri, new vscode.Position(74, 46), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		});
		await testCompletion(docUri, new vscode.Position(74, 46), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class }
			]
		});

		//
		// After semi-colon ended statement same line
		// Line 75
		// VSCodeExtJS.common.PhysicianDropdown.create();
		// After create(); i.e. .create( ... ); AppUtils.
		//
		await testCompletion(docUri, new vscode.Position(74, 48), "A", {
			items: [
				{ label: "AppUtils", kind: vscode.CompletionItemKind.Class }
			]
		});
		await testCompletion(docUri, new vscode.Position(74, 48), "E", {
			items: [
				{ label: "Ext", kind: vscode.CompletionItemKind.Class }
			]
		});
		await testCompletion(docUri, new vscode.Position(74, 48), "U", {
			items: [
				{ label: "Utils", kind: vscode.CompletionItemKind.Class }
			]
		});
		await testCompletion(docUri, new vscode.Position(74, 48), "V", {
			items: [
				{ label: "VSCodeExtJS", kind: vscode.CompletionItemKind.Class }
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
		}, true, "inherited define properties inside patient object");
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
		}, true, "inherited define properties inside physician object");
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
		// phys.delete();
		//
		await configuration.update("intellisenseIncludeDeprecated", false);
		await configuration.update("intellisenseIncludePrivate", false);
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method }
			]
		});
		//
		// Line 84
		// let pin2 = phys.getPinNumber();
		//
		await testCompletion(docUri, new vscode.Position(83, 18), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method }
			]
		});
		//
		// const phys2 = new VSCodeExtJS.common.PhysicianDropdown...
		// Line 90
		// let pin3 = phys2.getPinNumber();
		//
		await testCompletion(docUri, new vscode.Position(89, 19), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method }
			]
		});
		//
		// Show deprecated
		//
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
		//
		// Show private
		//
		await configuration.update("intellisenseIncludePrivate", true);
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method },
				// { label: "getPinNumberInternal (private)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
			]
		});
		//
		// Line 82
		// const pin = phys.getPinNumber();
		//
		await testCompletion(docUri, new vscode.Position(81, 19), ".", {
			items: [
				{ label: "getPinNumber (since v1.0.0)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPin (deprecated)", kind: vscode.CompletionItemKind.Method },
				// { label: "getPinNumberInternal (private)", kind: vscode.CompletionItemKind.Method },
				{ label: "getPinNumberInternal (private) (since v1.0.2)", kind: vscode.CompletionItemKind.Method }
			]
		});
		//
		// Revert settings
		//
		await configuration.update("intellisenseIncludeDeprecated", incDeprecated);
		await configuration.update("intellisenseIncludePrivate", incPrivate);
	});


	test("Statics block properties and methods", async () =>
	{
		//
		// Line 193
		// VSCodeExtJS.common.PhysicianDropdown.stopAll
		//
		await testCompletion(docUri, new vscode.Position(192, 38), ".", {
			items: [
				{ label: "stopAll (static) (since v0.4.0)", kind: vscode.CompletionItemKind.Method },
				{ label: "staticVariable (static)", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "statics block properties and methods");
	});


	test("Privates block properties and methods", async () =>
	{
		const incPrivate = configuration.get<boolean>("intellisenseIncludePrivate");
		await configuration.update("intellisenseIncludePrivate", true);
		//
		// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
		// Line 83
		// phys.*
		//
		await testCompletion(docUri, new vscode.Position(82, 7), ".", {
			items: [
				{ label: "stopAllPriv (private) (since v0.5.0)", kind: vscode.CompletionItemKind.Method },
				{ label: "privateVariable (private)", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "privates block properties and methods");

		await configuration.update("intellisenseIncludePrivate", incPrivate);
	});


	test("Inline class s a parameter", async () =>
	{   //
		// Line 109
		// me.testFn2();
		// Insert a first parameter that will be a class completion
		//
		await insertDocContent("VSCodeExtJS.", toRange(108, 13, 108, 13));
		await waitForValidation();
		//
		// Line 109
		// me.testFn2(me.testFn4(...
		//
		await testCompletion(docUri, new vscode.Position(108, 25), ".", {
			items: [
				{ label: "common", kind: vscode.CompletionItemKind.Class },
				{ label: "AppUtilities", kind: vscode.CompletionItemKind.Class },
				{ label: "view", kind: vscode.CompletionItemKind.Class },
				{ label: "main", kind: vscode.CompletionItemKind.Class },
				{ label: "mixins", kind: vscode.CompletionItemKind.Class },
				{ label: "model", kind: vscode.CompletionItemKind.Class },
				{ label: "store", kind: vscode.CompletionItemKind.Class }
			]
		}, true, "inline class as a 1st parameter");
		//
		// Insert a first parameter
		//
		await insertDocContent(", AppUtils.", toRange(108, 24, 108, 25));
		await waitForValidation();
		//
		// 2nd parameter
		//
		await testCompletion(docUri, new vscode.Position(108, 35), ".", {
			items: [
				{ label: "alertError", kind: vscode.CompletionItemKind.Method },
				{ label: "publicProperty", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "inline class as a 2nd parameter");
		//
		// Remove added text, set document back to initial state
		//
		await insertDocContent("", toRange(108, 13, 108, 35));
		await waitForValidation();
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
		const items = [
			{ label: "xtype: component", kind: vscode.CompletionItemKind.Property },
			{ label: "xtype: grid", kind: vscode.CompletionItemKind.Property },
			{ label: "xtype: gridpanel", kind: vscode.CompletionItemKind.Property },
			{ label: "xtype: patientdropdown", kind: vscode.CompletionItemKind.Property },
			{ label: "xtype: physiciandropdown", kind: vscode.CompletionItemKind.Property },
			{ label: "xtype: userdropdown", kind: vscode.CompletionItemKind.Property }
		];
		//
		// Line 187 - 191
		// const grid = Ext.create({
		//	   hidden: false,
		//	   disabled: true,
		//
		// });
		//
		await testCompletion(docUri, new vscode.Position(189, 3), "x", { items });
		//
		// Typing a 'quote-char' after an 'xtype:' text
		// Remove added text, set document back to initial state
		//
		await insertDocContent("xtype: \"\"", toRange(189, 3, 189, 3));
		await waitForValidation();
		await testCompletion(docUri, new vscode.Position(189, 10), "\"", { items });
		await insertDocContent("", toRange(189, 3, 189, 12));
		await waitForValidation();
		//
		// Line 121-123 - should return nothing, since the component is defined
		// in the 1st argument to Ext.create, no 'xtype: ...' items
		//
		// const patient = Ext.create('VSCodeExtJS.common.PatientDropdown', {
		//
		// });
		//
		await testCompletion(docUri, new vscode.Position(121, 3), "x", {
			items: []
		});
	});


	test("Full type lines", async () =>
	{
		const items = [
			{ label: "type: users", kind: vscode.CompletionItemKind.Property },
			{ label: "type: appadmin", kind: vscode.CompletionItemKind.Property },
			{ label: "type: array", kind: vscode.CompletionItemKind.Property },
			{ label: "type: store", kind: vscode.CompletionItemKind.Property }
		];
		//
		// Line 187 - 191
		// const grid = Ext.create({
		//	   hidden: false,
		//	   disabled: true,
		//
		// });
		//
		await testCompletion(docUri, new vscode.Position(189, 3), "t", { items });
		//
		// Typing a 'quote-char' after a 'type:' text
		// Remove added text, set document back to initial state
		//
		await insertDocContent("type: \"\"", toRange(189, 3, 189, 3));
		await waitForValidation();
		await testCompletion(docUri, new vscode.Position(189, 9), "\"", { items });
		await insertDocContent("", toRange(189, 3, 189, 11));
		await waitForValidation();
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
	});


	test("Object 'xtype' configs and properties", async () =>
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
		}, true, "inherited xtype properties inside physician object");

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
		}, true, "inherited xtype properties inside patient object");

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


	test("Object 'type' configs and properties", async () =>
	{   //
		// Line 203 - 207 Store filter object
		// Within main object
		// 199
		// 200    store2:
		// 201    {
		// 202        type: "users",
		// 203        filters: [
		// 204        {
		// 205            property: "userid",
		// 206
		// 207        }],
		// 208
		// 209        sorters: [
		// 210        {
		// 211           ...
		//
		// await testCompletion(docUri, new vscode.Position(205, 5), "", {
		// 	items: [
		// 		{ label: "operator", kind: vscode.CompletionItemKind.Property },
		// 		{ label: "property", kind: vscode.CompletionItemKind.Property },
		// 		{ label: "value", kind: vscode.CompletionItemKind.Property }
		// 	]
		// });
		await testCompletion(docUri, new vscode.Position(207, 4), "a", {
			items: [
				{ label: "autoDestroy AbstractStore config", kind: vscode.CompletionItemKind.Property },
				{ label: "autoFilter AbstractStore config", kind: vscode.CompletionItemKind.Property },
				{ label: "autoSort AbstractStore config", kind: vscode.CompletionItemKind.Property },
				{ label: "autoLoad ProxyStore config", kind: vscode.CompletionItemKind.Property },
				{ label: "autoSync ProxyStore config", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "object 'type' configs and properties");
		await testCompletion(docUri, new vscode.Position(207, 4), "f", {
			items: [
				{ label: "fields ProxyStore config", kind: vscode.CompletionItemKind.Property },
				{ label: "filters AbstractStore config", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "object 'type' configs and properties");
	});


	test("Property values", async () =>
	{   //
		// Line 167
		// Within main object
		// dockedItems: [
		// {
		//     xtype: "physiciandropdown"
		// }...
		//
		await insertDocContent("\t\treadOnly:", toRange(166, 0, 166, 11));
		await waitForValidation();

		await testCompletion(docUri, new vscode.Position(166, 11), ":", {
			items: [
				{ label: "false", kind: vscode.CompletionItemKind.Value },
				{ label: "true", kind: vscode.CompletionItemKind.Value }
			]
		}, true, "readOnly property values");

		await insertDocContent("\t\tuserName:", toRange(166, 0, 166, 11));
		await waitForValidation();

		await testCompletion(docUri, new vscode.Position(166, 11), ":", {
			items: [
				{ label: "String Value", kind: vscode.CompletionItemKind.Value }
			]
		}, true, "userName property value");
		//
		// Grid / object value
		//
		// await insertDocContent("fields:", toRange(207, 4, 207, 4));
		// await waitForValidation();
		// await testCompletion(docUri, new vscode.Position(207, 10), ":", {
		// 	items: [
		// 		{ label: "Array Value", kind: vscode.CompletionItemKind.Value },
		// 		{ label: "Object Value", kind: vscode.CompletionItemKind.Value }
		// 	]
		// }, true, "object 'type' configs and properties");
		// //
		// // Remove added text, set document back to initial state
		// //
		// await insertDocContent("", toRange(207, 4, 207, 12));
	});


	test("Behind comments", async () =>
	{
		//
		// Should show nothing behind a comment...
		//
		// 1 /**
		// 2  * @class VSCodeExtJS
		// 3  *
		// 4  * The VSCodeExtJS app root namespace.
		// 5  */
		//
		await insertDocContent("VSCodeExtJS", toRange(2, 3, 2, 3));
		await waitForValidation();

		await testCompletion(docUri, new vscode.Position(2, 14), ".", {
			items: []
		}, true, "behind comment method");
		//
		// Remove added text, set document back to initial state
		//
		await insertDocContent("", toRange(2, 3, 2, 14));
		await waitForValidation();
	});


	test("No completion", async () =>
	{	//
		// Outside object range
		//
		await testCompletion(docUri, new vscode.Position(222, 1), "V", {
			items: []
		}, true, "outside completion ranges");
		await waitForValidation();

		//
		// Open non extjs doc outside of a classpath
		//
		const jssUri = getDocUri("app/js/script1.js");
		const doc = await vscode.workspace.openTextDocument(jssUri);
		await vscode.window.showTextDocument(doc);
		assert(vscode.window.activeTextEditor, "No active editor");
		await waitForValidation();
		await testCompletion(docUri, new vscode.Position(4, 0), "A", {
			items: []
		}, true, "non-extjs file");
		await waitForValidation();
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		await waitForValidation();
	});


	test("Non-ExtJS document", async () =>
	{
		const jssUri = getDocUri("app/js/script1.js");
		try {
			const doc = await vscode.workspace.openTextDocument(jssUri);
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		}
		catch (e) {
			console.error(e);
		}
		await waitForValidation();
		await testCompletion(jssUri, new vscode.Position(2, 12), ".", {
			items: []
		}, true, "non-extjs file");
		try {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		}
		catch {}
		await waitForValidation();
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

	// const logKind = "Class";
	// const logDescRgx = /inline class as a/;
	// if (testDesc && logDescRgx.test(testDesc))
	// {
	// 	console.log("####################################");
	// 	console.log(docUri.path);
	// 	console.log("actual items length", actualCompletionList.items.length);
	// 	console.log("expected items length", expectedCompletionList.items.length);
	// 	console.log("####################################");
	// 	actualCompletionList.items.forEach((actualItem) => {
	// 		// if (triggerChar) { // && actualItem.kind && vscode.CompletionItemKind[actualItem.kind] === logKind) {
	// 			console.log(actualItem.label, actualItem.kind ? vscode.CompletionItemKind[actualItem.kind] : "");
	// 		// }
	// 	});
	// }

	if (testDesc !== "no_fail")
	{
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
}
