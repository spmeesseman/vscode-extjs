import { commands } from "vscode";
import { configuration } from "../../common/configuration";
import { quoteChar } from "../../common/clientUtils";
import { extjsLangMgr } from "../../extension";
import { activate, waitForValidation } from "./helper";


suite("API Tests", () =>
{

	suiteSetup(async () =>
    {
		await activate();
	});


	suiteTeardown(async () =>
    {
		extjsLangMgr.setBusy(false);
	});


	test("Clear AST", async function()
	{
		await commands.executeCommand("vscode-extjs:clearAst", "testFixture");
		await waitForValidation();
		extjsLangMgr.setBusy(true);
		await commands.executeCommand("vscode-extjs:clearAst", "testFixture");
		await commands.executeCommand("vscode-extjs:clearAst", "testFixture", true);
	});


	test("Indexing", async function()
	{
		this.timeout(60 * 1000);
		await commands.executeCommand("vscode-extjs:indexFiles");
		extjsLangMgr.setBusy(false);
		await commands.executeCommand("vscode-extjs:indexFiles");
		await waitForValidation();
		extjsLangMgr.setBusy(true);
		await commands.executeCommand("vscode-extjs:indexFiles", undefined, false);
		extjsLangMgr.setBusy(false);
		await commands.executeCommand("vscode-extjs:indexFiles", undefined, false);
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:indexFiles", "testFixture");
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:indexFiles", "testFixture", false, "   ");
		await waitForValidation();
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Configuration", async() =>
	{   //
		// Do some settings manipulation that'll improve coverage...
		//
		const qChar = configuration.get<string>("quoteCharacter", "single");
		await configuration.update("quoteCharacter", "single");
		quoteChar();
		await configuration.update("quoteCharacter", "double");
		quoteChar();
		await configuration.update("quoteCharacter", qChar);
	});

});
