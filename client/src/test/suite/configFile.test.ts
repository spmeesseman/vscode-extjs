
import * as path from "path";
import { commands, workspace } from "vscode";
import { copyFile, deleteFile, renameFile, writeFile } from "../../../../common";
import { storage } from "../../common/storage";
import { configuration } from "../../common/configuration";
import { ExtJsApi, IExtjsLanguageManager } from "../../common/interface";
import {
	getDocUri, waitForValidation, activate, getDocPath, insertDocContent, toRange, closeActiveDocument, closeActiveDocuments
} from "./helper";


suite("Config File Tests", () =>
{

	let extJsApi: ExtJsApi;
	let extjsLangMgr: IExtjsLanguageManager;
	const wsJsonUri = getDocUri("workspace.json");
	const appJsonUri = getDocUri("app.json");
	const appJsonPath = getDocPath("app.json");
	const extjsrcPath = getDocPath(".extjsrc.json");


	suiteSetup(async function ()
    {
		this.timeout(45 * 1000);
		//
		// Just some additional coverage, as of 3/7/21 this isn't covered but want to leave
		// in the fn implementation (case with a default value supplied in call to get)
		//
		storage.get<string>("storage_test", "test");
		const testsApi = await activate(wsJsonUri);
		extJsApi = testsApi.extJsApi;
		extjsLangMgr = extJsApi.extjsLangMgr;
	});


	suiteTeardown(async () =>
    {
		await closeActiveDocuments();
	});


	test("Remove all configs", async () =>
	{
		await renameFile(appJsonPath, path.join(path.dirname(appJsonPath), "_app.json"));
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
		await waitForValidation(true, 1000);

		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": [ "extjs" ],\r\n' +
            '    "name": "Ext"\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
	});


	test("Extjsrc remove name", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": "extjs"\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
	});


	test("Extjsrc add build directory", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": [ "app" ],\r\n' +
            '    "name": "VSCodeExtJS",\r\n' +
            '    "buildDir": "build"\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
	});


	test("Extjsrc add framework directory", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": [ "app" ],\r\n' +
            '    "name": "VSCodeExtJS",\r\n' +
            '    "framework": "c:\\\\Projects\\\\vscode-extjs\\\\client\\\\testFixture\\\\extjs"\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
	});


	test("Extjsrc duplicated classpath", async () =>
	{
		const settingsPaths = configuration.get<string[]>("include", []);
		await configuration.update("include", [ "VSCodeExtJS|c:\\Projects\\vscode-extjs\\client\\testFixture\\app" ]);
		await waitForValidation();
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": [ "app", "app" ],\r\n' +
            '    "name": "VSCodeExtJS",\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
		await waitForValidation();
		await (commands.executeCommand("vscode-extjs:indexFiles", "testFixture", false));
		await waitForValidation();
		//
		// Reset configuration settings
		//
		await configuration.update("include", settingsPaths);
		await waitForValidation();
	});


	test("Extjsrc add invalid framework directory", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": [ "app" ],\r\n' +
            '    "name": "VSCodeExtJS",\r\n' +
            '    "framework": "c:\\\\Projects\\\\vscode-extjs-invalid\\\\client\\\\testFixture\\\\extjs"\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
	});


	test("Extjsrc add invalid framework directory outside workspace", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": [ "app" ],\r\n' +
            '    "name": "VSCodeExtJS",\r\n' +
            '    "framework": "c:\\\\Code\\\\sencha"\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
	});


	test("Extjsrc add invalid json", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": "app",\r\n' +
            '    "name": "VSCodeExtJS"\r\n' + // <- no comma
            '    "framework": "c:\\\\Projects\\\\vscode-extjs\\\\client\\\\testFixture\\\\extjs"\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
	});


	test("Extjsrc restore", async () =>
	{
		await writeFile(
            extjsrcPath,
			"{\r\n" +
            '    "classpath": "",\r\n' +
            '    "name": "VSCodeExtJS"\r\n' +
            "}\r\n"
        );
		await waitForValidation(true, 1000);
	});


	test("Extension path settings - include", async () =>
	{
		const settingsPaths = configuration.get<string[]>("include", []);
		//
		// Set include paths
		//
		await configuration.update("include", [ "VSCodeExtJS|c:\\Projects\\vscode-extjs\\client\\testFixture\\app" ]);
		await waitForValidation();
		//
		// Some additional coverage - force prompt w/o tests flag set
		//
		extjsLangMgr.setTests(false);
		await configuration.update("include", [ "app" ]); // invalid path value must be name|path
		await waitForValidation();
		extjsLangMgr.setTests(true);
		await waitForValidation();
		//
		// Reset configuration settings
		//
		await configuration.update("include", settingsPaths);
		await waitForValidation();
	});


	test("Extension path settings - framework directory", async () =>
	{
		const fwDirectory = configuration.get<string>("frameworkDirectory", undefined);
		//
		// Set global framework path
		//
		await configuration.update("frameworkDirectory", "c:\\Projects\\vscode-extjs\\client\\testFixture\\extjs");
		await waitForValidation();
		//
		// Set global framework path outside workspace dir
		//
		await configuration.update("frameworkDirectory", "c:\\Sencha\\extjs\\ext-7.2\\classic\\classic\\src");
		await waitForValidation();
		//
		// Set tests to 'false' to cover branch for user prompt for config file change
		//
		extjsLangMgr.setTests(false);
		await configuration.update("frameworkDirectory", undefined);
		await waitForValidation();
		extjsLangMgr.setTests(true);
		//
		// Reset configuration settings
		//
		await configuration.update("frameworkDirectory", fwDirectory);
		await waitForValidation();
	});


	test("Invalid extension path settings - include", async () =>
	{
		const settingsPaths = configuration.get<string[]>("include", []);
		await waitForValidation();
		//
		await configuration.update("include", [ "app" ]); // invalid path value must be name|path
		await waitForValidation();
		//
		await configuration.update("include", [ "VSCodeExtJS|" ]);
		await waitForValidation();
		//
		await configuration.update("include", [ "VSCodeExtJS|c:\\Projects\\vscode-extjsBadPath" ]);
		await waitForValidation();
		//
		// Reset (for local tests, this won't matter in a CI environment)
		//
		await configuration.update("include", settingsPaths);
		await waitForValidation();
	});


	test("Add back app.json", async () =>
	{
		await renameFile(path.join(path.dirname(appJsonPath), "_app.json"), appJsonPath);
		await waitForValidation();
	});


	test("Open tooling extjs framework location", async function()
	{
		this.timeout(50 * 1000);
		//
		// Write an open tooling extjs framework location
		//
		await insertDocContent("node_modules/@sencha/ext", toRange(3, 16, 3, 21), true);
		//
		// Reset
		//
		await insertDocContent("extjs", toRange(3, 16, 3, 40), true);
		//
		// Set tests to 'false' to cover branch for user prompt for config file change
		//
		extjsLangMgr.setTests(false);
		//
		await insertDocContent("node_modules/@sencha/ext", toRange(3, 16, 3, 21), true);
		//
		// Reset framework path to "extjs"
		//
		await insertDocContent("extjs", toRange(3, 16, 3, 40), true);
		extjsLangMgr.setTests(true);
	});


	test("Workspace.json package.dir", async function()
	{
		this.timeout(50 * 1000);
		//
		// Remove packages.dir property
		//
		await insertDocContent("", toRange(11, 8, 11, 2000), true);
		//
		// Now remove packages property
		//
		await insertDocContent("", toRange(8, 5, 13, 5), true);
		//
		// Reset
		//
		await insertDocContent(`,
    "packages":
    {
        "dir": "\${workspace.dir}/node_modules/@spmeesseman/extjs-pkg,\${workspace.dir}/node_modules/@spmeesseman/extjs-pkg2,\${workspace.dir}/node_modules/@spmeesseman/extjs-pkg3,\${workspace.dir}/node_modules/@spmeesseman/extjs-pkg4,\${workspace.dir}/node_modules/@spmeesseman/extjs-pkg5,\${workspace.dir}/node_modules/@spmeesseman/extjs-pkg6",
        "extract": "\${workspace.dir}/packages/remote"
    }`, toRange(8, 5, 8, 5));
		await workspace.saveAll();
		await waitForValidation();
	});


	test("Workspace.json frameworks.ext", async function()
	{   //
		// Remove frameworks.ext property
		//
		await insertDocContent("", toRange(3, 8, 3, 22), true);
		//
		// Now remove frameworks property
		//
		await insertDocContent("", toRange(1, 4, 4, 6), true);
		//
		// Reset
		//
		await insertDocContent(`"frameworks":
    {
        "ext": "extjs"
    },`, toRange(1, 4, 1, 4));
		await workspace.saveAll();
		await waitForValidation();
	});


	test("Remove workspace.json", async () =>
	{
		await renameFile(wsJsonUri.fsPath, path.join(path.dirname(wsJsonUri.fsPath), "_ws.json"));
		await waitForValidation();
		await renameFile(path.join(path.dirname(wsJsonUri.fsPath), "_ws.json"), wsJsonUri.fsPath);
		await waitForValidation();
	});


	test("app.json remove modern classpath", async () =>
	{
		await closeActiveDocument();
		await activate(appJsonUri);
		await copyFile(appJsonPath, path.join(path.dirname(appJsonPath), "_app.json"));
		await insertDocContent("\r\n\r\n\r\n", toRange(75, 8, 78, 10), true);
	});


	test("app.json remove classic configuration", async () =>
	{
		await insertDocContent("", toRange(43, 4, 71, 6), true);
	});


	test("app.json remove modern configuration", async () =>
	{
		await insertDocContent("", toRange(45, 4, 73, 6), true);
	});


	test("app.json add base string classpath", async () =>
	{
		await insertDocContent("\"classpath\": \"app\",", toRange(43, 4, 43, 40), true);
	});


	test("app.json add base array classpath", async () =>
	{
		await insertDocContent("\"classpath\": [\"app\"],", toRange(43, 4, 43, 42), true);
	});


	test("app.json remove name", async () =>
	{
		await insertDocContent("", toRange(1, 4, 1, 26), true); // remove 'name' property
	});


	test("Restore app.json", async () =>
	{
		await closeActiveDocument();
		extjsLangMgr.setTests(false);
		await deleteFile(appJsonPath);
		await renameFile(path.join(path.dirname(appJsonPath), "_app.json"), appJsonPath);
		extjsLangMgr.setTests(true);
		await waitForValidation();
	});


	test("app.json invalid json", async () =>
	{
		await activate(appJsonUri);
		await insertDocContent("aaa^", toRange(0, 0, 0, 4), true);
		await insertDocContent("{", toRange(0, 0, 0, 4), true);
		await closeActiveDocument();
	});


	test("workspace.json invalid json", async () =>
	{
		await activate(wsJsonUri);
		await insertDocContent("aaa^", toRange(0, 0, 0, 4), true);
		await insertDocContent("{", toRange(0, 0, 0, 4), true);
		await closeActiveDocument();
	});


	test("Re-index files", async () =>
	{
		await commands.executeCommand("vscode-extjs:indexFiles");
		await waitForValidation();
	});

});
