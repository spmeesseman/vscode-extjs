
import * as log from "../../common/log";
import { getDocUri, activate, toRange, waitForValidation } from "./helper";
import { configuration } from "../../common/configuration";


suite("Logging Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let logEnabled: boolean | undefined;


	suiteSetup(async () =>
    {
		await activate(docUri);
		logEnabled = configuration.get<boolean>("debugClient");
		await configuration.update("debugClient", true);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {
		await configuration.update("debugClient", logEnabled);
		await waitForValidation();
	});


	test("Run logging functions", async () =>
	{
		log.write("Test1", 1);
		log.value("Test2", "value", 1);
		log.value("Test3", null, 1);
		log.value("Test4", undefined, 1);
		log.values([["Test5", "5"]], 1, "   ");
		log.values([["Test6", "6"]], 1, "   ", true);
		log.error("Test5 error");
		log.error(new Error("Test error object"));
		log.error([ "Test error 1", "Test error 2" ]);
		log.error([ "Test error 1",  new Error("Test error object") ]);
		log.error([ "Test error 1", "Test error 2" ], [["Test param error", "Test param value"]]);
	});


	test("Show and write to output window", async () =>
	{
		log.showLogOutput(true);
		log.write("Test");
		log.value("Test", "value", 1);
		log.write("Test", 3);
		log.error("Test error");
		log.error(new Error("Test error object"));
		log.error([ "Test error 1", "Test error 2" ]);
		log.error([ "Test error 1", new Error("Test error object") ]);
		log.error([ "Test error 1", "Test error 2" ], [["Test param error", "Test param value"]]);
		log.showLogOutput(false);
	});

	test("Turn logging off", async () =>
	{
		await configuration.update("debugClient", false);
		log.write("Test");
		log.value("Test", "value", 1);
		log.values([["Test5", "5"]], 1, "");
		log.methodStart("method start", 1, "", false, [["Test5", "5"]]);
		log.methodDone("method done", 1, "", false, [["Test5", "5"]]);
		log.error("Test error");
		log.error([ "Test error 1", "Test error 2" ]);
		await configuration.update("debugClient", true);
	});

	test("Write to console", async () =>
	{
		log.setWriteToConsole(true, 1);
		log.write("Test", 1);
		log.value("Test", "value", 1);
		log.setWriteToConsole(true, 2);
		log.write("Test", 1);
		log.value("Test", "value", 1);
		log.write("Test no write", 3);
		log.value("Test no write", "value", 3);
		log.error("Test error");
		log.error([ "Test error 1", "Test error 2" ]);
		log.setWriteToConsole(false);
	});

});
