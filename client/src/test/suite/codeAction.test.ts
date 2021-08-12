
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, waitForValidation } from "./helper";
import { ErrorCode, utils } from "../../../../common";
import { configuration } from "../../common/configuration";


suite("Code Action Tests", () =>
{
	let ignoreErrors: any[];
	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		ignoreErrors = configuration.get<any[]>("ignoreErrors");
		await configuration.update("ignoreErrors", []);
		await activate(docUri);
	});


	suiteTeardown(async () =>
    {
		await configuration.update("ignoreErrors", ignoreErrors);
	});


	test("Requires for xtypes", async () =>
	{
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
				arguments: [ "userdropdown" ]
			}
        },
		{
			title: "Fix the 'requires' array for all declared xtypes",
            command: {
				title: "Fix the 'requires' array for all declared xtypes",
				command: "vscode-extjs:ensureRequire"
			}
        }]);
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
