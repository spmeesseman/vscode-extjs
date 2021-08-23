
import * as path from "path";
import { commands, window, workspace } from "vscode";
import { renameSync } from "fs";
import { copyFile, deleteFile, readFile, writeFile } from "../../../../common/lib/fs";
import { getDocUri, waitForValidation, activate, getDocPath, insertDocContent, toRange } from "./helper";
import { storage } from "../../common/storage";
import { configuration } from "../../common/configuration";
import { extjsLangMgr } from "../../extension";


suite("Config File Tests", () =>
{

	const wsJsonUri = getDocUri("workspace.json");
	const appJsonUri = getDocUri("app.json");
	const appJsonPath = getDocPath("app.json");
	const extjsrcPath = getDocPath(".extjsrc.json");
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {   //
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
		//
		// Just some additional coverage, as of 3/7/21 this isn't covered but want to leave
		// in the fn implementation (case with a default value supplied in call to get)
		//
		storage.get<string>("storage_test", "test");
		await activate(wsJsonUri);
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("validationDelay", validationDelay || 1250);
	});


	test("Remove all configs", async () =>
	{
		renameSync(appJsonPath, path.join(path.dirname(appJsonPath), "_app.json"));
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Add back extjsrc config", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": "extjs",\r\n' +
            '    "name": "Ext"\r\n' +
            "}\r\n"
        );
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");

		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": [ "extjs" ],\r\n' +
            '    "name": "Ext"\r\n' +
            "}\r\n"
        );
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Extjsrc remove name", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": "extjs"\r\n' +
            "}\r\n"
        );
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Extjsrc config restore", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": "",\r\n' +
            '    "name": "Ext"\r\n' +
            "}\r\n"
        );
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Extension path settings", async () =>
	{
		const fwDirectory = configuration.get<string>("frameworkDirectory", undefined);
		const settingsPaths = configuration.get<string[]>("include", []);
		await configuration.update("frameworkDirectory", "extjs");
		await configuration.update("include", [ "app" ]); // invalid path value must be name|path
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		await configuration.update("include", [ "VSCodeExtJS|app" ]);
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Set tests to 'false' to cover branch for user prompt for config file change
		//
		extjsLangMgr.setTests(false);
		await configuration.update("frameworkDirectory", undefined);
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		extjsLangMgr.setTests(true);
		//
		// Reset (for local tests, this won't matter in a CI environment)
		//
		await configuration.update("include", settingsPaths);
		await configuration.update("frameworkDirectory", fwDirectory);
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Add back app.json", async () =>
	{
		renameSync(path.join(path.dirname(appJsonPath), "_app.json"), appJsonPath);
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Open tooling extjs framework location", async function()
	{
		this.timeout(45 * 1000);
		//
		// Write an open tooling extjs framework location
		//
		insertDocContent("node_modules/@sencha/ext", toRange(3, 16, 3, 21));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Reset
		//
		insertDocContent("extjs", toRange(3, 16, 3, 40));
		await workspace.saveAll();

		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Set tests to 'false' to cover branch for user prompt for config file change
		//
		extjsLangMgr.setTests(false);
		insertDocContent("node_modules/@sencha/ext", toRange(3, 16, 3, 21));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Reset framework path to "extjs"
		//
		insertDocContent("extjs", toRange(3, 16, 3, 40));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		extjsLangMgr.setTests(true);
	});


	test("Workspace.json package.dir", async function()
	{
		//
		// Remove packages.dir property
		//
		insertDocContent("", toRange(11, 8, 11, 70));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Now remove packages property
		//
		insertDocContent("", toRange(8, 5, 13, 5));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Reset
		//
		insertDocContent(`,
    "packages":
    {
        "dir": "\${workspace.dir}/node_modules/@spmeesseman/extjs-pkg",
        "extract": "\${workspace.dir}/packages/remote"
    }`, toRange(8, 5, 8, 5));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});



	test("Workspace.json frameworks.ext", async function()
	{
		//
		// Remove frameworks.ext property
		//
		insertDocContent("", toRange(3, 8, 3, 22));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Now remove frameworks property
		//
		insertDocContent("", toRange(1, 4, 4, 6));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Reset
		//
		insertDocContent(`"frameworks":
    {
        "ext": "extjs"
    },`, toRange(1, 4, 1, 4));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Remove workspace.json", async () =>
	{
		renameSync(wsJsonUri.fsPath, path.join(path.dirname(wsJsonUri.fsPath), "_ws.json"));
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		renameSync(path.join(path.dirname(wsJsonUri.fsPath), "_ws.json"), wsJsonUri.fsPath);
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("app.json remove classpath", async () =>
	{
		await commands.executeCommand("workbench.action.closeActiveEditor");
		await activate(appJsonUri);
		await waitForValidation();
		await copyFile(appJsonPath, path.join(path.dirname(appJsonPath), "_app.json"));
		insertDocContent("", toRange(43, 4, 101, 6)); // clear classic/modern properties
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});

	test("app.json add base string classpath", async () =>
	{
		insertDocContent("\"classpath\": \"app\",", toRange(43, 4, 43, 40));
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("app.json remove name", async () =>
	{
		insertDocContent("", toRange(1, 4, 1, 26)); // clear classic/modern properties
		await workspace.saveAll();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		await commands.executeCommand("workbench.action.closeActiveEditor");
		extjsLangMgr.setTests(false);
		await deleteFile(appJsonPath);
		renameSync(path.join(path.dirname(appJsonPath), "_app.json"), appJsonPath);
		extjsLangMgr.setTests(true);
		await waitForValidation();
	});


	test("Re-index files", async () =>
	{
		await commands.executeCommand("vscode-extjs:indexFiles");
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});

});
