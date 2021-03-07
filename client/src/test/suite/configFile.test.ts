
import * as vscode from "vscode";
import * as path from "path";
import { unlinkSync, writeFileSync, renameSync } from "fs";
import { getDocUri, waitForValidation, activate, toRange, getDocPath } from "./helper";
import { configuration } from "../../common/configuration";


suite("Config File Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	const appJsonPath = getDocPath("app.json");
	const extjsrcPath = getDocPath(".extjsrc.json");
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {
		await activate(docUri);
		//
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("validationDelay", validationDelay || undefined);
	});


	test("Test remove all configs", async () =>
	{
		renameSync(appJsonPath, path.join(path.dirname(appJsonPath), "_app.json"));
		//
		// Wait for validation x2
		//
		await waitForValidation();
		await waitForValidation();
	});


	test("Test extjsrc config", async () =>
	{
		writeFileSync(
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

		writeFileSync(
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
	});


	test("Test add back app.json", async () =>
	{
		renameSync(path.join(path.dirname(appJsonPath), "_app.json"), appJsonPath);
		//
		// Wait for validation x3
		//
		await waitForValidation();
		await waitForValidation();
		await waitForValidation();
	});

});
