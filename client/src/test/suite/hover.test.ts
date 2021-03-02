/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";


suite("Hover Tests", () =>
{
	const docUri = getDocUri("app/shared/src/app.js");

	test("Test classes", async () =>
	{
		await testHover(docUri, new vscode.Position(71, 4), "VSCodeExtJS");
		await testHover(docUri, new vscode.Position(71, 17), "VSCodeExtJS.AppUtilities");
		await testHover(docUri, new vscode.Position(74, 17), "VSCodeExtJS.common");
		await testHover(docUri, new vscode.Position(74, 23), "VSCodeExtJS.common.PhysicianDropdown");
	});

	test("Test class methods", async () =>
	{
		await testHover(docUri, new vscode.Position(71, 28), "VSCodeExtJS.AppUtilities.alertError");
		await testHover(docUri, new vscode.Position(74, 40), "VSCodeExtJS.common.PhysicianDropdown.create");
	});

	test("Test aliases", async () =>
	{
		await testHover(docUri, new vscode.Position(72, 4), "AppUtils");
		await testHover(docUri, new vscode.Position(72, 12), "AppUtils.alertError");
	});

	test("Test configs", async () =>
	{
		await testHover(docUri, new vscode.Position(67, 20), "test");
		await testHover(docUri, new vscode.Position(68, 20), "test3");
		await testHover(docUri, new vscode.Position(69, 20), "getTest");
		await testHover(docUri, new vscode.Position(70, 8), "setTest");
	});

	test("Test local variables", async () =>
	{
		await testHover(docUri, new vscode.Position(81, 15), "phys");
		await testHover(docUri, new vscode.Position(82, 3), "phys");
	});

});


async function testHover(docUri: vscode.Uri, position: vscode.Position, commentString: string)
{
	await activate(docUri);

	const actualHoverList = (await vscode.commands.executeCommand(
		"vscode.executeHoverProvider",
		docUri,
		position
	)) as vscode.Hover[];

	assert.ok(actualHoverList.length >= 1);

	const hover: vscode.Hover = actualHoverList[0];
	hover.contents.forEach((c) => {

	});
}
