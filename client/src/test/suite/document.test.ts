
import * as assert from "assert";
import * as vscode from "vscode";
import { deleteFile, renameFile, writeFile } from "../../../../common/lib/fs";
import { configuration } from "../../common/configuration";
import { ExtJsApi, IExtjsLanguageManager } from "../../extension";
import { getDocUri, waitForValidation, activate, toRange, getDocPath, insertDocContent, closeActiveDocuments, closeActiveDocument } from "./helper";


suite("Document Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	const newDocPath = getDocPath("app/shared/src/app2.js");
	const newDocPath2 = getDocPath("app/shared/src/app3.js");
	const newDocPathToDelete = getDocPath("app/shared/src/app4.js");
	let validationDelay: number | undefined;
	let ignoreErrors: any[];
	let extJsApi: ExtJsApi;
	let extjsLangMgr: IExtjsLanguageManager;


	suiteSetup(async function ()
    {
		this.timeout(60 * 1000);
		//
		// Set debounce to minimum for test
		//
		const testsApi = await activate(docUri);
		extJsApi = testsApi.extJsApi;
		extjsLangMgr = extJsApi.extjsLangMgr;
		await waitForValidation();
		validationDelay = configuration.get<number>("validationDelay");
		ignoreErrors = configuration.get<any[]>("ignoreErrors");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
		await configuration.update("ignoreErrors", []);
		await configuration.update("debugClient", true);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("ignoreErrors", ignoreErrors);
		await configuration.update("validationDelay", validationDelay || 1250);
		await waitForValidation();
		await closeActiveDocuments();
		await waitForValidation();
	});


	test("Edit document", async () =>
	{
		const workspaceEdit = new vscode.WorkspaceEdit();
		//
		// Write document to trigger document change events - re-indexing and validation
		//
		workspaceEdit.replace(docUri, toRange(95, 0, 95, 0), "\t\tVSCodeExtJS.AppUtilities.alertError('This is a test');");
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:replaceText command to erase the text we just inserted
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "        ", toRange(95, 0, 95, 56));
		await waitForValidation();
	});


	test("Add new documents", async () =>
	{
		await writeFile(
            newDocPath,
			"Ext.define('VSCodeExtJS.Test',\r\n" +
            "{\r\n" +
            '    "prop1": "vscode-taskexplorer",\r\n' +
            '    "config":{\r\n' +
            '        "cfg1": "node ./node_modules/vscode/bin/test",\r\n' +
            "    }\r\n" +
            "});\r\n"
        );
		await waitForValidation();

		await writeFile(
            newDocPathToDelete,
			"Ext.define('VSCodeExtJS.Test2',\r\n" +
            "{\r\n" +
            '    "prop1": "vscode-taskexplorer",\r\n' +
            '    "config":{\r\n' +
            '        "cfg1": "node ./node_modules/vscode/bin/test",\r\n' +
            "    }\r\n" +
            "});\r\n"
        );
		await waitForValidation();

		let c = extjsLangMgr.getComponent("VSCodeExtJS.Test", "testFixture", "", 1);
		assert(c?.fsPath === newDocPath);

		c = extjsLangMgr.getComponent("VSCodeExtJS.Test2", "testFixture", "", 1);
		assert(c?.fsPath === newDocPathToDelete);
	});


	test("Rename document", async () =>
	{
		await renameFile(newDocPath, newDocPath2);
		await waitForValidation();
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
		const c = extjsLangMgr.getComponent("VSCodeExtJS.Test", "testFixture", "", 1);
		assert(c?.fsPath === newDocPath2);
	});


	test("Change classname", async () =>
	{   //
		// Inline changing of class name in Ext.define()
		//
		await activate(getDocUri(newDocPath2));
		await waitForValidation();

		insertDocContent("22", toRange(0, 25, 0, 25));
		await waitForValidation();

		insertDocContent("33", toRange(0, 25, 0, 25));
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");

		await vscode.workspace.saveAll();
		await waitForValidation();

		//
		// Renamed the class name, so VSCodeExtJS.T3322est should  now exist
		//
		assert(extjsLangMgr.getComponent("VSCodeExtJS.T3322est", "testFixture", "", 1));
		assert(!extjsLangMgr.getComponent("VSCodeExtJS.T22est", "testFixture", "", 1));
		assert(!extjsLangMgr.getComponent("VSCodeExtJS.Test", "testFixture", "", 1));
	});


	test("Clear document content", async () =>
	{
		insertDocContent("", toRange(0, 0, 6, 3));
		await vscode.workspace.saveAll();
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		assert(!extjsLangMgr.getComponent("VSCodeExtJS.T3322est", "testFixture", "", 1));
	});


	test("Delete document", async () =>
	{
		await deleteFile(newDocPath2);
		await waitForValidation();
		await deleteFile(newDocPathToDelete);
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
		assert(!extjsLangMgr.getComponent("VSCodeExtJS.Test", "testFixture", "", 1));
		assert(!extjsLangMgr.getComponent("VSCodeExtJS.Test2", "testFixture", "", 1));
	});


    // test("Add workspace folder", async () =>
    // {
    // 	// await vscode.commands.executeCommand("vscode.openFolder");
    // 	// vscode.workspace.
    // 	// await waitForValidation();
    // });


	test("Non-ExtJS document", async () =>
	{   //
		// Open non extjs doc outside of a classpath
		//
		let jssUri = getDocUri("js/script1.js");
		try {
			const doc = await vscode.workspace.openTextDocument(jssUri);
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		await waitForValidation();
		//
		// Open non extjs doc inside of a classpath
		//
		jssUri = getDocUri("app/js/script1.js");
		try {
			const doc = await vscode.workspace.openTextDocument(jssUri);
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		await waitForValidation();
	});


	test("Ignored document", async () =>
	{   //
		// Open file that should be ignored
		//
		const jssUri = getDocUri("app/shared/src/test/Test.js");
		await activate(jssUri);
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
		await closeActiveDocument();
		await waitForValidation();
	});


	test("Simultaneous non-awaited open", async () =>
	{   //
		// Open file that should be ignored
		//
		const jssUri = getDocUri("app/shared/src/test/Test.js"),
			  doc = await vscode.workspace.openTextDocument(jssUri),
			  jssUri2 = getDocUri("app/js/script1.js"),
			  doc2 = await vscode.workspace.openTextDocument(jssUri2),
			  jssUri3 = getDocUri("app/classic/src/common/YesNo.js"),
			  doc3 = await vscode.workspace.openTextDocument(jssUri3);
		vscode.window.showTextDocument(doc);
		vscode.window.showTextDocument(doc2);
		vscode.window.showTextDocument(doc3);
		await waitForValidation();
		await closeActiveDocument();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
	});

});
