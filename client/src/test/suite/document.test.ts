
import * as assert from "assert";
import * as vscode from "vscode";
import { deleteFile, renameFile, writeFile } from "../../../../common";
import { getTimestampKey } from "../../common/clientUtils";
import { configuration } from "../../common/configuration";
import { storage } from "../../common/storage";
import { ExtJsApi, IExtjsLanguageManager } from "../../common/interface";
import { getDocUri, waitForValidation, activate, toRange, getDocPath, insertDocContent, closeActiveDocuments, closeActiveDocument } from "./helper";


suite("Document Tests", () =>
{

	const docPath = getDocPath("app/shared/src/app.js");
	const docUri = getDocUri("app/shared/src/app.js");
	const newDocPath = getDocPath("app/shared/src/app2.js");
	const newDocPath2 = getDocPath("app/shared/src/app3.js");
	const dupPathDoc = getDocPath("app/shared/src/app4.js");
	const newDocPathToDelete = getDocPath("app/shared/src/app5.js");
	const invalidPathDoc = getDocPath("app/shared/src/app6.js");
	let ignoreErrors: any[];
	let extJsApi: ExtJsApi;
	let extjsLangMgr: IExtjsLanguageManager;


	suiteSetup(async function ()
    {
		this.timeout(45 * 1000);
		const testsApi = await activate(docUri);
		extJsApi = testsApi.extJsApi;
		extjsLangMgr = extJsApi.extjsLangMgr;
		ignoreErrors = configuration.get<any[]>("ignoreErrors");
		await configuration.update("ignoreErrors", []);
		await configuration.update("debugClient", true);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("ignoreErrors", ignoreErrors);
		await waitForValidation();
		await closeActiveDocuments();
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
		// Trigger persist to fs cache
		//
		await vscode.workspace.saveAll();
		await waitForValidation();
		//
		// Use the extension's vscode-extjs:replaceText command to erase the text we just inserted
		//
		await vscode.commands.executeCommand("vscode-extjs:replaceText", "        ", toRange(95, 0, 95, 56));
		await waitForValidation();
		//
		// Trigger persist to fs cache
		//
		await vscode.workspace.saveAll();
		await waitForValidation();
		//
		// Trigger the de-bouncer
		//
		await configuration.update("validationDelay", 1000);
		workspaceEdit.replace(docUri, toRange(95, 0, 95, 0), "c");
		workspaceEdit.replace(docUri, toRange(95, 0, 95, 0), "b");
		workspaceEdit.replace(docUri, toRange(95, 0, 95, 0), "a");
		workspaceEdit.replace(docUri, toRange(95, 0, 95, 3), "");
		await configuration.update("validationDelay", 250); // set back to minimum validation delay
		await waitForValidation();
	});


	test("Non-notified document edit", async () =>
	{
		const d = new Date();
		d.setDate(d.getDate() - 2);
		await storage.update(getTimestampKey(docPath), d.toString());
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:indexFiles", "testFixture", false);
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

		await closeActiveDocument();

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

		await activate(docUri); // re-open main document

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
		await waitForValidation();
		const c = extjsLangMgr.getComponent("VSCodeExtJS.Test", "testFixture", "", 1);
		assert(c?.fsPath === newDocPath2);
	});


	test("Change classname", async () =>
	{   //
		// Inline changing of class name in Ext.define()
		//
		await activate(getDocUri(newDocPath2));

		await insertDocContent("22", toRange(0, 25, 0, 25));

		await insertDocContent("33", toRange(0, 25, 0, 25));

		await vscode.workspace.saveAll();
		await waitForValidation();
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
		insertDocContent("", toRange(0, 0, 6, 3), true);
		await waitForValidation();
		await waitForValidation();
		await closeActiveDocument();
		assert(!extjsLangMgr.getComponent("VSCodeExtJS.T3322est", "testFixture", "", 1));
	});


	test("Create duplicate class file", async () =>
	{
		await writeFile(
            dupPathDoc,
			"Ext.define('VSCodeExtJS.AppUtilities',\r\n" +
            "{\r\n" +
            '    "prop1": "vscode-taskexplorer",\r\n' +
            '    "config":{\r\n' +
            '        "cfg1": "node ./node_modules/vscode/bin/test",\r\n' +
            "    }\r\n" +
            "});\r\n"
        );
		await waitForValidation();
	});


	test("Invalid ExtJS document", async () =>
	{
		await writeFile(
            invalidPathDoc,
			"Ext.define('VSCodeExtJS.AppUtilities',\r\n" +
            "{\r\n" +
            '    "prop1": "vscode-taskexplorer",\r\n' +
            '    "config":{\r\n' +
            '        "cfg1": "node ./node_modules/vscode/bin/test",\r\n' +
            "    }\r\n" +
            "\r\n" // <- missing closing });
        );
		await waitForValidation();
	});


	test("Delete document", async () =>
	{
		await deleteFile(newDocPath2);
		await waitForValidation();
		await closeActiveDocument(); // close all files, no active editor
		await deleteFile(dupPathDoc);
		await waitForValidation();
		await deleteFile(invalidPathDoc);
		await waitForValidation();
		assert(!extjsLangMgr.getComponent("VSCodeExtJS.Test", "testFixture", "", 1));
	});


	test("Non-notified document delete", async () =>
	{
		assert(extjsLangMgr.getComponent("VSCodeExtJS.Test2", "testFixture", "", 1));
		extjsLangMgr.setTests({
			disableFileWatchers: true
		});
		await deleteFile(newDocPathToDelete);
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:indexFiles", "testFixture", false);
		await waitForValidation();
		extjsLangMgr.setTests(true);
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
		await activate(getDocUri("js/script1.js"));
		await closeActiveDocument();
		//
		// Open non extjs doc inside of a classpath
		//
		await activate(getDocUri("app/js/script1.js"));
		await closeActiveDocument();
	});


	test("Ignored document", async () =>
	{   //
		// Open file that should be ignored
		//
		const jssUri = getDocUri("app/shared/src/test/Test.js");
		await activate(jssUri);
		await closeActiveDocument();
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
	});

});
