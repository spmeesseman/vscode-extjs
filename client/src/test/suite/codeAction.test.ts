
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "./helper";
import { ErrorCode, utils } from "../../../../common";


suite("Code Action Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
	});

/*
	test("Syntax", async () =>
	{
		//
		// Line 67 CCC caps text
		//
		const range = toRange(66, 0, 66, 3);
		await testCodeAction(docUri, range, [
        {
            title: "Ignore errors of this type (file)",
            command: {
				title: "Ignore errors of this type (file)",
            	command: "vscode-extjs:ignoreError",
            	arguments: [ ErrorCode.syntaxAllCaps, docUri.fsPath ]
			}
        },
		{
            title: "Ignore errors of this type (global)",
            command: {
				title: "Ignore errors of this type (global)",
            	command: "vscode-extjs:ignoreError",
            	arguments: [ ErrorCode.syntaxAllCaps ]
			}
        },
		{
            title: "Convert to camel case",
            command: {
				title: "Convert to camel case",
            	command: "vscode-extjs:replaceText",
            	arguments: [ utils.toCamelCase("CCC", 1), range ]
			}
        },
		{
            title: "Convert to lower case",
            command: {
				title: "Convert to lower case",
            	command: "vscode-extjs:replaceText",
            	arguments: [ utils.toCamelCase("CCC", 1), range ]
			}
        }]);
	});
*/
	test("Requires for xtypes", async () =>
	{
		//
		// Line 34 - app component
		// patieuntdropdown - invalid xtype, should be patientdropdown
		//
		const range1 = toRange(36, 9, 36, 27);
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
		await testCodeAction(docUri, toRange(39, 9, 39, 23), [
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

});


async function testCodeAction(docUri: vscode.Uri, range: vscode.Range, expectedCommands: vscode.CodeAction[])
{
	const actualCommands = (await vscode.commands.executeCommand(
		"vscode.executeCodeActionProvider",
		docUri,
		range,
		vscode.CodeActionKind.QuickFix.value
	)) as vscode.CodeAction[];

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
