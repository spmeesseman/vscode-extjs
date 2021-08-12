import { commands } from "vscode";
import { activate, waitForValidation } from "./helper";


suite("API Tests", () =>
{

	suiteSetup(async () =>
    {
		await activate();
	});


	test("Test commands with no document open", async () =>
	{
		await commands.executeCommand("vscode-extjs:waitReady");
		await commands.executeCommand("vscode-extjs:clearAst", "testFixture");
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:indexFiles");
		await waitForValidation();
		await commands.executeCommand("vscode-extjs:ignoreError");
		await commands.executeCommand("vscode-extjs:ensureRequire");
		await commands.executeCommand("vscode-extjs:ensureRequire", "physiciandropdown");
		await commands.executeCommand("vscode-extjs:replaceText", "text");
		await commands.executeCommand("vscode-extjs:replaceText");
	});

});
