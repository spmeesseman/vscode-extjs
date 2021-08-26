
import * as log from "../../common/log";
import { getDocUri, activate, toRange } from "./helper";
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
	});


	suiteTeardown(async () =>
    {
		await configuration.update("debugClient", logEnabled);
	});


	test("Run logging functions", async () =>
	{
		log.write("Test", 1);
		log.value("Test", "value", 1);
		log.error("Test error");
		log.error(new Error("Test error object"));
		log.error([ "Test error 1", "Test error 2" ]);
		log.error([ "Test error 1", "Test error 2", new Error("Test error object") ]);
		log.error([ "Test error 1", "Test error 2" ], [["Test param error", "Test param value"]]);
	});


	test("Show and write to output window", async () =>
	{
		log.showLogOutput(true);
		log.write("Test");
		log.value("Test", "value", 1);
		log.error("Test error");
		log.error(new Error("Test error object"));
		log.error([ "Test error 1", "Test error 2" ]);
		log.error([ "Test error 1", "Test error 2", new Error("Test error object") ]);
		log.error([ "Test error 1", "Test error 2" ], [["Test param error", "Test param value"]]);
		log.showLogOutput(false);
	});

	test("Turn logging off", async () =>
	{
		await configuration.update("debugClient", false);
		log.write("Test");
		log.value("Test", "value", 1);
		log.error("Test error");
		log.error([ "Test error 1", "Test error 2" ]);
		await configuration.update("debugClient", true);
	});

	test("Write to console", async () =>
	{
		log.setWriteToConsole(true);
		log.write("Test");
		log.value("Test", "value", 1);
		log.error("Test error");
		log.error([ "Test error 1", "Test error 2" ]);
		log.setWriteToConsole(false);
	});

});
