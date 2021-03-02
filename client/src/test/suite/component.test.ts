
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, sleep } from "./helper";


suite("Component Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
	});


	test("AppUtils", async () =>
	{

	});

});


async function getComponent(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[])
{
	await sleep(500);
}
