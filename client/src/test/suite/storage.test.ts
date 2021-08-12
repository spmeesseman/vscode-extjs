
import * as assert from "assert";
import { activate, sleep } from "./helper";
import { storage } from "../../common/storage";
import { fsStorage } from "../../common/fsStorage";
import { commands } from "vscode";


suite("Storage Tests", () =>
{

	suiteSetup(async () =>
    {
		await activate();
	});


	test("Test app global storage", async () =>
	{
		await commands.executeCommand("vscode-extjs:waitReady");
		await storage?.update("storage_test_1", "test1");
		let value = storage?.get<string>("storage_test", "test");
		await sleep(100);
		assert.strictEqual(value, "test");
		value = storage?.get<string>("storage_test_nodefault");
		assert.strictEqual(value, undefined);
	});


	test("Test fs global storage", async () =>
	{
		await fsStorage?.update("test1/test1.keyfile", "test1");
		await sleep(100);
		let value = fsStorage?.get("test1/test1.keyfile");
		assert.strictEqual(value, "test1");
		await fsStorage?.update("test2/test2/test2.keyfile", "test2");
		await sleep(100);
		value = fsStorage?.get("test2/test2/test2.keyfile");
		assert.strictEqual(value, "test2");
		await sleep(100);
		fsStorage?.clear();
		await sleep(1000);
		await commands.executeCommand("vscode-extjs:indexFiles");
		await sleep(500);
	});

});
