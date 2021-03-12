import { commands } from "vscode";
import { getDocUri, activate } from "./helper";


suite("API Tests", () =>
{

	let extJsApi = {};


	suiteSetup(async () =>
    {
		extJsApi = await activate();
	});


	test("Test commands with no document open", async () =>
	{
		await commands.executeCommand("vscode-extjs:ignoreError");
		await commands.executeCommand("vscode-extjs:ensureRequire");
		await commands.executeCommand("vscode-extjs:ensureRequire", "physiciandropdown");
		await commands.executeCommand("vscode-extjs:replaceText", "text");
		await commands.executeCommand("vscode-extjs:replaceText");
		// await commands.executeCommand("vscode-extjs:indexFiles", "physiciandropdown");
	});

});
