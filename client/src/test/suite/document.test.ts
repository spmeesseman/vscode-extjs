
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, sleep } from "./helper";


suite("Hover Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
	});


	test("Test edit", async () =>
	{
		const workspaceEdit = new vscode.WorkspaceEdit(),
		 	  config = vscode.workspace.getConfiguration(),
			  validationDelay = config.get<boolean>("extjsLangMgr.validationDelay");
		//
		// Set debounce to minimum for test
		//
		await config.update("extjsLangMgr.validationDelay", 250); // set to minimum validation delay
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
		// Reset debounce to original value b4 changed.  FOr running tests locally, this technically
		// doesnt matter when the tests are ran in a CI
		//
		await vscode.workspace.getConfiguration().update("extjsLangMgr.validationDelay", validationDelay);
	});

});
