
import * as path from "path";
import * as assert from "assert";
import { activate, getDocPath, waitForValidation } from "./helper";
import { storage } from "../../common/storage";
import { fsStorage } from "../../common/fsStorage";
import { getStorageKey, getUserDataPath } from "../../common/clientUtils";
import { commands } from "vscode";
import { ExtJsApi, IExtjsLanguageManager } from "../../common/interface";


let extJsApi: ExtJsApi;
let extjsLangMgr: IExtjsLanguageManager;


suite("Storage Tests", () =>
{

	suiteSetup(async function()
    {
		this.timeout(45 * 1000);
		const testsApi = await activate();
		extJsApi = testsApi.extJsApi;
		extjsLangMgr = extJsApi.extjsLangMgr;
	});


	test("Global storage", async () =>
	{   //
		// The fs module on dev test will run through win32 path get.  Simulate
		// path get here for linux and mac for increased coverage since we're only
		// running the tests in a windows machine for release right now with ap.
		//
		let dataPath: string | undefined = getUserDataPath("darwin");
		dataPath = getUserDataPath("linux");

		//
		// Simulate --user-data-dir vscode command line option
		//
		const oArgv = process.argv;
		process.argv = [ "--user-data-dir", dataPath ];
		dataPath = getUserDataPath("linux");
		dataPath = getUserDataPath("win32");
		dataPath = getUserDataPath("darwin");

		//
		// 0 args, which would probably never happen but the getUserDataPath() call
		// handles it an ;et's cover it
		//
		process.argv = [];
		dataPath = getUserDataPath("win32");

		//
		// Save current environment
		//
		dataPath = process.env.VSCODE_PORTABLE;
		const dataPath1 = dataPath;
		const dataPath2 = process.env.APPDATA;
		const dataPath3 = process.env.USERPROFILE;
		const dataPath4 = process.env.VSCODE_APPDATA;
		//
		// Set environment variables for specific test
		//
		process.env.VSCODE_PORTABLE = getUserDataPath("win32");
		process.env.APPDATA = "";
		process.env.USERPROFILE = "test";
		dataPath = getUserDataPath("win32");
		assert.strictEqual(dataPath, "C:\\Projects\\vscode-extjs\\.vscode-test\\vscode-win32-archive-1.60.0\\test\\AppData\\Roaming\\vscode");
		//
		// Set environment variables for specific test
		//
		dataPath = "";
		process.env.VSCODE_PORTABLE = dataPath;
		process.env.APPDATA = dataPath2;
		process.env.USERPROFILE = dataPath3;
		dataPath = getUserDataPath("nothing");
		assert.strictEqual(dataPath, "C:\\Projects\\vscode-extjs\\.vscode-test\\vscode-win32-archive-1.60.0");
		//
		// Set environment variables for specific test
		//
		process.env.VSCODE_PORTABLE = undefined;
		process.env.APPDATA = dataPath2;
		process.env.USERPROFILE = dataPath3;
		dataPath = getUserDataPath("win32");
		assert.strictEqual(dataPath, "C:\\Users\\smeesseman.PERRYJOHNSON01\\AppData\\Roaming\\vscode");
		//
		// Set environment variables for specific test
		//
		process.env.VSCODE_PORTABLE = "c:\\some\\invalid\\path";
		process.env.APPDATA = dataPath2;
		process.env.USERPROFILE = dataPath3;
		dataPath = getUserDataPath("win32");
		assert.strictEqual(dataPath, "C:\\Users\\smeesseman.PERRYJOHNSON01\\AppData\\Roaming\\vscode");
		//
		// Set environment variables for specific test
		//
		process.env.VSCODE_PORTABLE = "C:\\Code\\data\\user-data\\User\\workspaceStorage";
		process.env.APPDATA = "";
		process.env.USERPROFILE = "";
		dataPath = getUserDataPath("win32");
		assert.strictEqual(dataPath, "C:\\Code\\data\\user-data\\User\\workspaceStorage\\user-data\\User");
		//
		// Set environment variables for specific test
		//
		process.env.VSCODE_PORTABLE = "";
		process.env.APPDATA = "";
		process.env.USERPROFILE = "";
		dataPath = getUserDataPath("win32");
		assert.strictEqual(dataPath, "C:\\Projects\\vscode-extjs\\.vscode-test\\vscode-win32-archive-1.60.0\\AppData\\Roaming\\vscode");
		//
		// Set environment variables for specific test
		//
		process.env.VSCODE_PORTABLE = "";
		process.env.APPDATA = "";
		process.env.USERPROFILE = "";
		process.env.VSCODE_APPDATA = "";
		dataPath = getUserDataPath("linux");
		assert.strictEqual(dataPath, "C:\\Projects\\vscode-extjs\\.vscode-test\\vscode-win32-archive-1.60.0\\.config\\vscode");
		dataPath = getUserDataPath("win32");
		assert.strictEqual(dataPath, "C:\\Projects\\vscode-extjs\\.vscode-test\\vscode-win32-archive-1.60.0\\AppData\\Roaming\\vscode");
		dataPath = getUserDataPath("darwin");
		assert.strictEqual(dataPath, "C:\\Projects\\vscode-extjs\\.vscode-test\\vscode-win32-archive-1.60.0\\Library\\Application Support\\vscode");
		dataPath = getUserDataPath("invalid_platform");
		assert.strictEqual(dataPath, "C:\\Projects\\vscode-extjs\\.vscode-test\\vscode-win32-archive-1.60.0");
		//
		//
		//
		process.env.VSCODE_PORTABLE = "C:\\Code\\data\\user-data\\User\\workspaceStorage";
		dataPath = getUserDataPath("invalid_platform");
		assert.strictEqual(dataPath, "C:\\Code\\data\\user-data\\User\\workspaceStorage\\user-data\\User");
		//
		// Restore process argv
		//
		process.argv = oArgv;
		//
		// Restore environment
		//
		process.env.VSCODE_PORTABLE = dataPath1;
		process.env.APPDATA = dataPath2;
		process.env.USERPROFILE = dataPath3;
		process.env.VSCODE_APPDATA = dataPath4;
		//
		// Some basic read/writes
		//
		await storage.update("storage_test_1", "test1");
		let value: string | undefined = storage.get<string>("storage_test", "test2");
		assert.strictEqual(value, "test2");
		value = storage.get<string>("storage_test_1", "test2");
		assert.strictEqual(value, "test1");
		value = storage.get<string>("storage_test_nodefault");
		assert.strictEqual(value, undefined);
	});


	test("Filesystem storage keys", async () =>
	{
		let key = getStorageKey("some\\path\\file.txt", "VSCodeExtJS");
		assert(key === path.normalize("file.txt\\VSCodeExtJS\\components.json"));
		key = getStorageKey("c:\\Projects\\vscode-extjs\\client\\testFixture", "VSCodeExtJS");
		assert(key === path.normalize("testFixture\\VSCodeExtJS\\components.json"));
	});


	test("Filesystem storage", async () =>
	{   //
		// Basic fs storage read/write
		//
		await fsStorage.update("test1/test1.keyfile", "test1");
		let value = await fsStorage.get("test1/test1.keyfile");
		assert.strictEqual(value, "test1");
		//
		// Basic fs storage read/write
		//
		await fsStorage.update("test2/test2/test2.keyfile", "test2");
		value = await fsStorage.get("test2/test2/test2.keyfile");
		assert.strictEqual(value, "test2");
		//
		// Clear storage
		//
		await fsStorage.clear("testFixture");
		await waitForValidation();
		//
		// Check component no longer exists
		//
		await waitForValidation();
		// assert(!extjsLangMgr.getComponent("VSCodeExtJS", "testFixture", "", 1));
		//
		// Re-index and check component again exists
		//
		await commands.executeCommand("vscode-extjs:indexFiles");
		await waitForValidation();
		assert(extjsLangMgr.getComponent("VSCodeExtJS", "testFixture", "", 1));
	});

});
