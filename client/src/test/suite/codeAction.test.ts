
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, waitForValidation, closeActiveDocuments, closeActiveDocument } from "./helper";
import { ErrorCode } from "../../../../common";
import { configuration } from "../../common/configuration";
import { defaultIgnoreTypes } from "../../common/clientUtils";


suite("Code Action Tests", () =>
{
	let ignoreErrors: any[];
	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
		ignoreErrors = configuration.get<any[]>("ignoreErrors");
		await configuration.update("ignoreErrors", []);
	});


	suiteTeardown(async () =>
    {
		await configuration.update("ignoreErrors", ignoreErrors);
		await closeActiveDocuments();
	});


	test("Requires for xtypes", async () =>
	{
		const quoteCharacter = configuration.get<string>("quoteCharacter", "single");
		await configuration.update("quoteCharacter", "single");
		//
		// Line 34 - app component
		// patieuntdropdown - invalid xtype, should be patientdropdown
		//
		const range1 = toRange(36, 10, 36, 27);
		await testCodeAction(docUri, range1, [
        {
			title: "Replace declared xtype with 'patientdropdown'",
            command: {
				title: "Replace declared xtype with 'patientdropdown'",
				command: "vscode-extjs:replaceText",
            	arguments: [ '"patientdropdown"', range1 ]
			}
        }]);
		//
		// Line 34 - app component
		// userdropdown - no requires
		//
		await testCodeAction(docUri, toRange(39, 10, 39, 23), [
        {
			title: "Fix the 'requires' array for this declared xtype",
			command: {
				title: "Fix the 'requires' array for this declared xtype",
				command: "vscode-extjs:ensureRequire",
				arguments: [ "userdropdown", "xtype" ]
			}
        },
		{
			title: "Fix the 'requires' array for all declared xtypes",
            command: {
				title: "Fix the 'requires' array for all declared xtypes",
				command: "vscode-extjs:ensureRequire",
				arguments: [ undefined, "xtype" ]
			}
        }]);

		await configuration.update("quoteCharacter", quoteCharacter);
	});


	test("Requires for types", async () =>
	{
		const quoteCharacter = configuration.get<string>("quoteCharacter", "single");
		await configuration.update("quoteCharacter", "single");

		//
		// Line 203 - 207 Store type object
		// 199
		// 200    store2:
		// 201    {
		// 202        type: "users",
		// 203        filters: [
		// 204        {
		// 205
		await testCodeAction(docUri, toRange(201, 11, 201, 17), [
        {
			title: "Fix the 'requires' array for this declared type",
			command: {
				title: "Fix the 'requires' array for this declared type",
				command: "vscode-extjs:ensureRequire",
				arguments: [ "userdropdown", "type" ]
			}
        },
		{
			title: "Fix the 'requires' array for all declared types",
            command: {
				title: "Fix the 'requires' array for all declared types",
				command: "vscode-extjs:ensureRequire",
				arguments: [ undefined, "type" ]
			}
        }]);

		//
		// Line 34 - app component
		// store { type: userss } - invalid type, should be users
		//
		const range1 = toRange(235, 9, 235, 16);
		await testCodeAction(docUri, range1, [
        {
			title: "Replace declared type with 'users'",
            command: {
				title: "Replace declared type with 'users'",
				command: "vscode-extjs:replaceText",
            	arguments: [ "'userss'", range1 ]
			}
        }]);

		await configuration.update("quoteCharacter", quoteCharacter);
	});


	test("Requires array", async () =>
	{	//
		// Open file with bad requires block
		//
		const badRequiresUri = getDocUri("app/classic/src/main/BadRequire.js");
		try {
			const doc = await vscode.workspace.openTextDocument(badRequiresUri);
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
		await waitForValidation();
		await waitForValidation();

		//
		// The requires array:
		//
		// 11
		// 12   requires: [
		// 13       "VSCodeExtJS.common.PhysicanDropdown",
		// 14       "Ext.frm.field.ComboBox"
		// 15   ],
		// 16
		//

		const data: vscode.CodeAction[] = [{
			title: "Ignore errors of this type (this line only)",
			command: {
				title: "Ignore errors of this type (this line only)",
				command: "vscode-extjs:ignoreError",
				arguments: [ ErrorCode.classNotFound, badRequiresUri.path, toRange(0, 0, 0, 0) ]
			}
		},
		{
			title: "Ignore errors of this type (file)",
			command: {
				title: "Ignore errors of this type (file)",
				command: "vscode-extjs:ignoreError",
				arguments: [ ErrorCode.classNotFound, badRequiresUri.path ]
			}
		},
		{
			title: "Ignore errors of this type (global)",
			command: {
				title: "Ignore errors of this type (global)",
				command: "vscode-extjs:ignoreError",
				arguments: [ ErrorCode.classNotFound ]
			}
		}];

		let range = toRange(12, 9, 12, 45);
		if (data[0].command && data[0].command.arguments) {
			data[0].command.arguments[2] = range;
			await testCodeAction(badRequiresUri, range, data);
			await waitForValidation();
		}
		else {
			assert.fail("undefined range for requires quick fix 1");
		}

		range = toRange(13, 9, 13, 32);
		if (data[0].command && data[0].command.arguments) {
			data[0].command.arguments[2] = range;
			await testCodeAction(badRequiresUri, range, data);
			await waitForValidation();
		}
		else {
			assert.fail("undefined range for requires quick fix 2");
		}

		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		await waitForValidation();
	});


	test("Uses array", async () =>
	{	//
		// Open file with bad requires block
		//
		const mainGridUri = getDocUri("app/shared/src/main/Grid.js");
		try {
			const doc = await vscode.workspace.openTextDocument(mainGridUri);
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
		await waitForValidation();
		await waitForValidation();

		//
		// The uses array:
		//
		// 09
		// 10   uses: [
        // 11     "Ext.rid.Panel"
    	// 12   ]
		// 13
		//

		const data: vscode.CodeAction[] = [{
			title: "Ignore errors of this type (this line only)",
			command: {
				title: "Ignore errors of this type (this line only)",
				command: "vscode-extjs:ignoreError",
				arguments: [ ErrorCode.classNotFound, mainGridUri.path, toRange(0, 0, 0, 0) ]
			}
		},
		{
			title: "Ignore errors of this type (file)",
			command: {
				title: "Ignore errors of this type (file)",
				command: "vscode-extjs:ignoreError",
				arguments: [ ErrorCode.classNotFound, mainGridUri.path ]
			}
		},
		{
			title: "Ignore errors of this type (global)",
			command: {
				title: "Ignore errors of this type (global)",
				command: "vscode-extjs:ignoreError",
				arguments: [ ErrorCode.classNotFound ]
			}
		}];

		const range = toRange(10, 8, 10, 23);
		if (data[0].command && data[0].command.arguments) {
			data[0].command.arguments[2] = range;
			await testCodeAction(mainGridUri, range, data);
			await waitForValidation();
		}
		else {
			assert.fail("undefined range for uses quick fix 1");
		}

		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		await waitForValidation();
	});


	test("Ignored types", async () =>
	{
		const ignoreTypes = configuration.get<string[]>("ignoreTypes", defaultIgnoreTypes);
		await configuration.update("ignoreTypes", []);
		await waitForValidation();
		await testCodeAction(docUri, toRange(241, 13, 241, 20), []);
		await configuration.update("ignoreTypes", [ "string" ]);
		await waitForValidation();
		await testCodeAction(docUri, toRange(241, 13, 241, 20), []); // "type: 'string'"" hits shouldIgnoreType()
		await configuration.update("ignoreTypes", ignoreTypes);
		await waitForValidation();
	});


	test("Unknown keywords", async () =>
	{
		await testCodeAction(docUri, toRange(230, 14, 230, 23), []);
	});


	test("Non-ExtJS document", async () =>
	{
		const jssUri = getDocUri("app/js/script1.js");
		await activate(jssUri);
		await testCodeAction(jssUri, toRange(2, 12, 2, 16), []);
		await closeActiveDocument();
	});

});


async function testCodeAction(docUri: vscode.Uri, range: vscode.Range, expectedCommands: vscode.CodeAction[])
{
	const actualCommands = (await vscode.commands.executeCommand(
		"vscode.executeCodeActionProvider",
		docUri,
		range,
		vscode.CodeActionKind.QuickFix.value
	)) as vscode.CodeAction[];

	// console.log("####################################");
	// console.log(docUri.path);
	// console.log("####################################");
	// console.log("Actual");
	// console.log("####################################");
	// actualCommands.forEach((d) => {
	// 	console.log("***********************");
	// 	console.log(d.title);
	// 	console.log("***********************");
	// 	if (d.command && d.command.arguments && d.command.arguments.length > 2) {
	// 		console.log("sLine: " + d.command.arguments[2].start.line);
	// 		console.log("sChar: " + d.command.arguments[2].start.character);
	// 		console.log("eLine: " + d.command.arguments[2].end.line);
	// 		console.log("eChar: " + d.command.arguments[2].end.character);
	// 	}
	// });
	// console.log("####################################");
	// console.log("Expected");
	// console.log("####################################");
	// expectedCommands.forEach((d) => {
	// 	console.log("***********************");
	// 	console.log(d.title);
	// 	console.log("***********************");
	// 	if (d.command && d.command.arguments && d.command.arguments.length > 2) {
	// 		console.log("sLine: " + d.command.arguments[2].start.line);
	// 		console.log("sChar: " + d.command.arguments[2].start.character);
	// 		console.log("eLine: " + d.command.arguments[2].end.line);
	// 		console.log("eChar: " + d.command.arguments[2].end.character);
	// 	}
	// });

	assert.ok(actualCommands.length >= expectedCommands.length);

	expectedCommands.forEach((expectedCommand) =>
	{
		assert.strictEqual(
            actualCommands.filter(item => item.title === expectedCommand.title &&
				                  item.command?.command === expectedCommand.command?.command &&
				                  item.command?.arguments?.length === expectedCommand.command?.arguments?.length).length,
            1
        );
	});
}
