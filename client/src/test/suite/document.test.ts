
import * as vscode from "vscode";
import { unlinkSync, writeFileSync } from "fs";
import { getDocUri, getNewDocUri, activate, toRange, sleep, getDocPath } from "./helper";


suite("Document Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	const newDocPath = getDocPath("app/shared/src/app2.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
	});


	test("Test edit document", async () =>
	{
		const workspaceEdit = new vscode.WorkspaceEdit(),
		 	  config = vscode.workspace.getConfiguration(),
			  validationDelay = config.get<number>("extjsLangSvr.validationDelay");
		//
		// Set debounce to minimum for test
		//
		await config.update("extjsLangSvr.validationDelay", 250); // set to minimum validation delay
		//
		// Write document to trigger document change events - re-indexing and validation
		//
		workspaceEdit.replace(docUri, toRange(95, 0, 95, 0), "\t\tVSCodeExtJS.AppUtilities.alertError('This is a test');");
		vscode.workspace.applyEdit(workspaceEdit);
		//
		// Wait for validation (debounce is 250ms)
		//
		await sleep(2000);
		//
		// Use the extension's vscode-extjs:replaceText command to erase the text we just inserted
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "", toRange(95, 0, 95, 56));
		//
		// Wait again for validation (debounce is 250ms)
		//
		await sleep(2000);
		//
		// Reset debounce to original value b4 changed.  FOr running tests locally, this technically
		// doesnt matter when the tests are ran in a CI
		//
		await vscode.workspace.getConfiguration().update("extjsLangSvr.validationDelay", validationDelay || 1250);
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
            "}\r\n"
        );
		//
		// Wait
		//
		await sleep(2000);
	});


	test("Test delete document", async () =>
	{
		unlinkSync(newDocPath);
		//
		// Wait
		//
		await sleep(2000);
	});

});
