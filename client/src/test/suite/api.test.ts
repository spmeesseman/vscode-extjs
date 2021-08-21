import { commands } from "vscode";
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

});
