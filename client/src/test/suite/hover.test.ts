/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, waitForValidation, sleep } from "./helper";
import { configuration } from "../../common/configuration";


suite("Hover Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {   //
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay", 1250);
		await configuration.update("validationDelay", 250); // set to minimum validation delay
		await activate(docUri);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("validationDelay", validationDelay);
		await waitForValidation();
		try {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		}
		catch {}
		await waitForValidation();
	});


	test("Re-index files", async () => // need to re-index for the tests that follow document.test
	{
		await vscode.commands.executeCommand("vscode-extjs:indexFiles");
		await waitForValidation();
		await vscode.commands.executeCommand("vscode-extjs:waitReady");
	});


	test("Classes", async () =>
	{
		await waitForValidation();
		await waitForValidation();
		await testHover(docUri, new vscode.Position(71, 4), "VSCodeExtJS");
		await testHover(docUri, new vscode.Position(71, 17), "VSCodeExtJS.AppUtilities");
		// await testHover(docUri, new vscode.Position(74, 17), "VSCodeExtJS.common");
		await testHover(docUri, new vscode.Position(74, 23), "VSCodeExtJS.common.PhysicianDropdown");
	});


	test("Class methods", async () =>
	{
		await testHover(docUri, new vscode.Position(71, 28), "VSCodeExtJS.AppUtilities.alertError");
		// await testHover(docUri, new vscode.Position(74, 40), "VSCodeExtJS.common.PhysicianDropdown.create");
	});


	test("Aliases", async () =>
	{
		await testHover(docUri, new vscode.Position(72, 4), "AppUtils");
		await testHover(docUri, new vscode.Position(72, 12), "AppUtils.alertError");
	});


	test("Configs", async () =>
	{
		await testHover(docUri, new vscode.Position(67, 20), "test");
		await testHover(docUri, new vscode.Position(68, 20), "test3");
		await testHover(docUri, new vscode.Position(69, 20), "getTest");
		await testHover(docUri, new vscode.Position(70, 8), "setTest");
	});


	test("Local variables", async () =>
	{   //
		// Line 74 - Primitive
		// const str = this.testFn5();
		//
		await testHover(docUri, new vscode.Position(73, 9), "string");
		//
		// Line 82
		// const pin = phys.getPinNumber();
		//
		await testHover(docUri, new vscode.Position(81, 9), "string");
		//
		// Line 82 - Primitive
		// const pin = phys.getPinNumber();
		//
		await testHover(docUri, new vscode.Position(81, 15), "VSCodeExtJS.common.PhysicianDropdown");
		//
		// Line 82 - Primitive
		// const pin = phys.getPinNumber();
		//
		await testHover(docUri, new vscode.Position(81, 21), "string");
		//
		// Line 83
		// phys.delete();
		//
		await testHover(docUri, new vscode.Position(82, 3), "VSCodeExtJS.common.PhysicianDropdown");
	});


	test("This keyword", async () =>
	{
		await testHover(docUri, new vscode.Position(108, 3), "VSCodeExtJS");
		await testHover(docUri, new vscode.Position(109, 3), "VSCodeExtJS");
	});


	test("Component xtypes", async () =>
	{
		await testHover(docUri, new vscode.Position(33, 11), "physiciandropdown");
		await testHover(docUri, new vscode.Position(39, 11), "userdropdown");
		// await testHover(docUri, new vscode.Position(45, 3), "component");
		//
		// Line 145
		// let cmp = this.down('physiciandropdown');
		//
		await testHover(docUri, new vscode.Position(144, 24), "physiciandropdown");
	});


	test("Store types", async () =>
	{
		//
		// Line 202
		// type: "users"
		// Is of type VSCodeExtJS.store.user.Users, not VSCodeExtJS.view.users.Users, which
		// is also of (x)type "users"
		//
		await testHover(docUri, new vscode.Position(201, 13), "users: VSCodeExtJS.store.user.Users");
	});


	test("Unknown keywords", async () =>
    {
		await testHover(docUri, new vscode.Position(150, 3));
		await testHover(docUri, new vscode.Position(241, 16)); // "type: 'string'"" hits shouldIgnoreType()
    });


	test("Non-ExtJS document", async () =>
	{   //
		// Open non extjs doc inside of a classpath
		//
		const jssUri = getDocUri("app/js/script1.js");
		try {
			const doc = await vscode.workspace.openTextDocument(jssUri);
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		} catch (e) {
			console.error(e);
		}
		await waitForValidation();
		//
		// Line 145
		// let cmp = this.down('physiciandropdown');
		//
		await testHover(jssUri, new vscode.Position(5, 12));

		await waitForValidation();
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	});

});


async function testHover(docUri: vscode.Uri, position: vscode.Position, commentString?: string, testDesc?: string, retry = 0)
{
	const actualHoverList = (await vscode.commands.executeCommand(
		"vscode.executeHoverProvider",
		docUri,
		position
	)) as vscode.Hover[];

	assert.ok(!commentString || actualHoverList.length >= 1, new Error(`Hover doc not found - ${commentString}`));

	let hasTag = false;
	for (const hover of actualHoverList)
	{
		for (const c of (hover.contents as vscode.MarkdownString[]))
		{
			if (c.value.toString().includes("@") || (commentString && c.value.toString().includes(commentString))) {
				hasTag = true;
				break;
			}
		}
		if (hasTag) { break; }
	}

	if (!hasTag && commentString && retry === 0) {
		await sleep(500);
		await testHover(docUri, position, commentString, testDesc, ++retry);
	}
	else {
		if (commentString) {
			assert.ok(hasTag === true, new Error(`${testDesc ? testDesc + " - " : ""}Tag not found in hover doc - ${commentString}`));
		}
		else {
			assert.ok(hasTag === false, new Error(`${testDesc ? testDesc + " - " : ""}Tag found in hover doc`));
		}
	}
}
