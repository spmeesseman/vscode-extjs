
import * as path from "path";
import { commands, workspace } from "vscode";
import { renameSync } from "fs";
import { readFile, writeFile } from "../../../../common/lib/fs";
import { getDocUri, waitForValidation, activate, getDocPath, insertDocContent, toRange } from "./helper";
import { storage } from "../../common/storage";
import { configuration } from "../../common/configuration";
import { extjsLangMgr } from "../../extension";


suite("Config File Tests", () =>
{

	const wsJsonUri = getDocUri("workspace.json");
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
		//
		// Wait for validation x2
		//
		await waitForValidation();
		await waitForValidation();
	});


	test("Extjsrc config", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": "extjs",\r\n' +
            '    "name": "Ext"\r\n' +
            "}\r\n"
        );
		//
		// Wait for validation x2
		//
		await waitForValidation();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");

		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": "",\r\n' +
            '    "name": "Ext"\r\n' +
            "}\r\n"
        );
		//
		// Wait for validation x2
		//
		await waitForValidation();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Extension settings config", async () =>
	{
		const settingsPaths = configuration.get<string[]>("settingsPaths");
	});


	test("Add back app.json", async () =>
	{
		renameSync(path.join(path.dirname(appJsonPath), "_app.json"), appJsonPath);
		//
		// Wait for validation x3
		//
		await waitForValidation();
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
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Reset
		//
		insertDocContent("extjs", toRange(3, 16, 3, 40));
		await workspace.saveAll();

		await waitForValidation();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Set tests to 'false' to cover branch for user prompt for config file change
		//
		extjsLangMgr.setTests(false);
		insertDocContent("node_modules/@sencha/ext", toRange(3, 16, 3, 21));
		await workspace.saveAll();
		await waitForValidation();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Reset framework path to "extjs"
		//
		insertDocContent("extjs", toRange(3, 16, 3, 40));
		await workspace.saveAll();
		await waitForValidation();
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
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
		//
		// Now remove packages property
		//
		insertDocContent("", toRange(8, 5, 13, 5));
		await workspace.saveAll();
		await waitForValidation();
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
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Re-index files", async () =>
	{
		await commands.executeCommand("vscode-extjs:indexFiles");
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});

});
