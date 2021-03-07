
import * as vscode from "vscode";
import { unlinkSync, writeFileSync } from "fs";
import { getDocUri, waitForValidation, activate, toRange, getDocPath } from "./helper";
import { configuration } from "../../common/configuration";


suite("Document Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	const newDocPath = getDocPath("app/shared/src/app2.js");
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {
		await activate(docUri);
		//
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("validationDelay", validationDelay || undefined);
	});


	test("Test edit document", async () =>
	{
		const workspaceEdit = new vscode.WorkspaceEdit();
		//
		// Write document to trigger document change events - re-indexing and validation
		//
		workspaceEdit.replace(docUri, toRange(95, 0, 95, 0), "\t\tVSCodeExtJS.AppUtilities.alertError('This is a test');");
		vscode.workspace.applyEdit(workspaceEdit);
		//
		// Wait for validation (debounce is 250ms)
		//
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:replaceText command to erase the text we just inserted
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(95, 0, 95, 56));
		//
		// Wait again for validation (debounce is 250ms)
		//
		await waitForValidation();
	});


	test("Test add new document", async () =>
	{
		writeFileSync(
            newDocPath,
			"Ext.define('VSCodeExtJS.Test',\r\n" +
            "{\r\n" +
            '    "prop1": "vscode-taskexplorer",\r\n' +
            '    "config":{\r\n' +
            '        "cfg1": "node ./node_modules/vscode/bin/test",\r\n' +
            "    }\r\n" +
            "});\r\n"
        );
		//
		// Wait
		//
		await waitForValidation();
	});


	test("Test delete document", async () =>
	{
		unlinkSync(newDocPath);
		//
		// Wait
		//
		await waitForValidation();
	});

});
