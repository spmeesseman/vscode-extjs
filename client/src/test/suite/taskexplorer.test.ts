
import * as vscode from "vscode";
import * as assert from "assert";
import { configuration } from "../../common/configuration";
import { getDocUri, activate, insertDocContent, toRange, waitForValidation } from "./helper";


suite("Task Explorer Tests", () =>
{
	let taskExplorerEnabled = false;
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {   //
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
		taskExplorerEnabled = configuration.get<boolean>("enableTaskView");
		await configuration.update("enableTaskView", true);
		await activate();
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {   //
		// Reset configuration
		//
		await configuration.update("validationDelay", validationDelay || 1250);
		await configuration.update("enableTaskView", taskExplorerEnabled);
		await waitForValidation();
	});


	test("Get build tasks", async () =>
	{
	});


	test("Trigger refresh", async () =>
	{
		await configuration.update("enableTaskView", true);
		await configuration.update("enableTaskView", false);
		await configuration.update("enableTaskView", true);
	});

});
