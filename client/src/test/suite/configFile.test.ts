
import * as path from "path";
import { workspace } from "vscode";
import { writeFileSync, renameSync } from "fs";
import { getDocUri, waitForValidation, activate, getDocPath, insertDocContent, toRange } from "./helper";
import { configuration } from "../../common/configuration";
import { storage } from "../../common/storage";


suite("Config File Tests", () =>
{

	const wsJsonUri = getDocUri("workspace.json");
	const appJsonPath = getDocPath("app.json");
	const extjsrcPath = getDocPath(".extjsrc.json");
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {
		await activate(wsJsonUri);
		//
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
		//
		// Just some additional coverage, as of 3/7/21 this isnt convered but want to leave
		// in the fn implementation (case with a default value supplied in call to get)
		//
		storage?.get<string>("storage_test", "test");
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


	test("Test open tooling extjs framework location", async () =>
	{
		//
		// Write an open tooling extjs framework location
		//
		insertDocContent("node_modules/@sencha/ext", toRange(3, 16, 3, 21));
		workspace.saveAll();
		//
		// Wait for validation x3
		//
		await waitForValidation();
		await waitForValidation();
		await waitForValidation();
		//
		// Reset
		//
		insertDocContent("extjs", toRange(3, 16, 3, 40));
		workspace.saveAll();
		//
		// Wait for validation x3
		//
		await waitForValidation();
		await waitForValidation();
		await waitForValidation();
	});

});
