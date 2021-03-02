
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, sleep } from "./helper";


suite("Component Tests", () =>
{
	const docUri = getDocUri("app/shared/src/app.js");

	test("AppUtils", async () =>
	{

	});
});


function toRange(sLine: number, sChar: number, eLine: number, eChar: number)
{
	const start = new vscode.Position(sLine, sChar);
	const end = new vscode.Position(eLine, eChar);
	return new vscode.Range(start, end);
}


async function getComponent(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[])
{
	await activate(docUri);

	// const actualDiagnostics = vscode.languages.getDiagnostics(docUri);
	//
	// assert.equal(actualDiagnostics.length, expectedDiagnostics.length);
	//
	// expectedDiagnostics.forEach((expectedDiagnostic, i) => {
	// 	const actualDiagnostic = actualDiagnostics[i];
	// 	assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
	// 	assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
	// 	assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
	// });

	await sleep(5000);
}
