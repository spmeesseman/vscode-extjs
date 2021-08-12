
import * as assert from "assert";
import { activate, sleep } from "./helper";
import { storage } from "../../common/storage";
import { fsStorage } from "../../common/fsStorage";
import { commands } from "vscode";
import { getUserDataPath } from "../../common/clientUtils";


suite("Storage Tests", () =>
{

	suiteSetup(async () =>
    {
		await activate();
	});


	test("Test app global storage", async () =>
	{   //
		// The fs module on dev test will run through win32 path get.  Simulate
		// path get here for linux and mac for increased coverage since we're only
		// running the tests in a windows machine for release right now with ap.
		//
		let dataPath: string | undefined = getUserDataPath("darwin");
		dataPath = getUserDataPath("linux");
		const oArgv = process.argv;
		process.argv = [ "--user-data-dir", dataPath ];
		dataPath = getUserDataPath("linux");
		process.argv = oArgv;
		dataPath = process.env.VSCODE_PORTABLE;
		const dataPath2 = process.env.APPDATA;
		const dataPath3 = process.env.USERPROFILE;
		process.env.VSCODE_PORTABLE = getUserDataPath("win32");
		process.env.APPDATA = "";
		process.env.USERPROFILE = "test";
		dataPath = getUserDataPath("win32");
		process.env.VSCODE_PORTABLE = dataPath;
		process.env.APPDATA = dataPath2;
		process.env.USERPROFILE = dataPath3;
		try {
			dataPath = getUserDataPath("nothing");
		}
		catch {}
		await commands.executeCommand("vscode-extjs:waitReady");
		await storage.update("storage_test_1", "test1");
		let value: string | undefined = storage.get<string>("storage_test", "test");
		await sleep(100);
		assert.strictEqual(value, "test");
		value = storage.get<string>("storage_test_nodefault");
		assert.strictEqual(value, undefined);
	});


	test("Test fs global storage", async () =>
	{
		await fsStorage.update("test1/test1.keyfile", "test1");
		await sleep(100);
		let value = await fsStorage.get("test1/test1.keyfile");
		assert.strictEqual(value, "test1");
		await fsStorage.update("test2/test2/test2.keyfile", "test2");
		await sleep(100);
		value = await fsStorage.get("test2/test2/test2.keyfile");
		assert.strictEqual(value, "test2");
		await sleep(100);
		fsStorage.clear();
		await sleep(1000);
		await commands.executeCommand("vscode-extjs:indexFiles");
		await sleep(500);
	});

});
