import { commands, Position } from "vscode";
import { configuration } from "../../common/configuration";
import { quoteChar } from "../../common/clientUtils";
import { activate, closeActiveDocument, getDocUri, waitForValidation } from "./helper";
import { ExtJsApi, IExtjsLanguageManager } from "../../extension";


suite("API Tests", () =>
{
	let extJsApi: ExtJsApi;
	let extjsLangMgr: IExtjsLanguageManager;


	suiteSetup(async function()
    {
		this.timeout(45 * 1000);
		const testsApi = await activate();
		extJsApi = testsApi.extJsApi;
		extjsLangMgr = extJsApi.extjsLangMgr;
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


	test("Miscellaneous api coverage", async() =>
	{   //
		// Do some extension api usage that'll improve coverage...
		//
		const api = await activate(getDocUri("app/js/script1.js"));
		extjsLangMgr.getLineProperties(api.doc, new Position(0, 0), "", 1);
		await closeActiveDocument();
	});


});
