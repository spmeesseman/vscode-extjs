/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, waitForValidation, sleep, closeActiveDocuments, closeActiveDocument } from "./helper";
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
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("validationDelay", validationDelay);
		await waitForValidation();
		await closeActiveDocuments();
	});


	test("Re-index files", async () => // need to re-index for the tests that follow document.test
	{
		await vscode.commands.executeCommand("vscode-extjs:indexFiles");
		await waitForValidation();
	});


	test("Classes", async () =>
	{   //
		// .create()
		//
		await waitForValidation();
		await testHover(docUri, new vscode.Position(71, 4), "class VSCodeExtJS: VSCodeExtJS");
		await testHover(docUri, new vscode.Position(71, 17), "singleton AppUtilities: VSCodeExtJS.AppUtilities");
		// await testHover(docUri, new vscode.Position(74, 17), "VSCodeExtJS.common");
		await testHover(docUri, new vscode.Position(74, 23), "VSCodeExtJS.common.PhysicianDropdown");
		//
		// app.js Line 351
		// \t\tconst patient = new VSCodeExtJS.common.PatientDropdown();
		//
		await testHover(docUri, new vscode.Position(350, 26), "class VSCodeExtJS: VSCodeExtJS");
		await testHover(docUri, new vscode.Position(350, 45), "class PhysicianDropdown: VSCodeExtJS.common.PhysicianDropdown");
	});


	test("Class methods", async () =>
	{
		await testHover(docUri, new vscode.Position(71, 28), "function alertError: returns boolean");
		// await testHover(docUri, new vscode.Position(74, 40), "VSCodeExtJS.common.PhysicianDropdown.create");
	});


	test("Private methods and properties", async () =>
	{
		await testHover(docUri, new vscode.Position(94, 28), "function stopAllPriv: returns string");
		await testHover(docUri, new vscode.Position(228, 44)); // <- improper non-static, returns nothing
	});


	test("Static methods and properties", async () =>
	{
		await testHover(docUri, new vscode.Position(192, 44), "function stopAll: returns boolean");
		await testHover(docUri, new vscode.Position(231, 44)); // undefined static method returns nothing
	});


	test("Aliases", async () =>
	{
		await testHover(docUri, new vscode.Position(72, 4), "singleton AppUtilities: VSCodeExtJS.AppUtilities");
		await testHover(docUri, new vscode.Position(72, 12), "function alertError: returns boolean");
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
		await testHover(docUri, new vscode.Position(81, 15), ": VSCodeExtJS.common.PhysicianDropdown");
		//
		// Line 82 - Primitive
		// const pin = phys.getPinNumber();
		//
		await testHover(docUri, new vscode.Position(81, 21), "string");
		//
		// Line 83
		// phys.delete();
		//
		await testHover(docUri, new vscode.Position(82, 3), ": VSCodeExtJS.common.PhysicianDropdown");
	});


	test("Methods with returns", async () =>
	{   //
		// Line 82
		// const pin = phys.getPinNumber();
		//
		await testHover(docUri, new vscode.Position(81, 24), "function getPinNumber: returns string");
	});


	test("Inherited instance methods", async () =>
	{   //
		// Line 95
		// phys3.load(b);
		//
		await testHover(docUri, new vscode.Position(94, 10), "function load: returns void");
	});


	test("Method parameters", async () =>
	{   //
		// Line 89 - method parameter 'a'
		// phys2.save(a);
		//
		await testHover(docUri, new vscode.Position(88, 13), "Test a");
		await testHover(docUri, new vscode.Position(94, 13), "Test b");
		//
		// Line 304 - method parameter 'displayField'
		// text: displayField
		// TODO - Not working
		// await testHover(docUri, new vscode.Position(303, 13), "");
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
		await testHover(docUri, new vscode.Position(201, 13), "store users: VSCodeExtJS.store.user.Users");
		//
		// In a filter config object
		//
		await testHover(docUri, new vscode.Position(273, 15), "store users: VSCodeExtJS.store.user.Users");
	});


	test("Filter types", async () =>
	{
		//
		// Line 295, 307
		// type: "yesno"
		//
		await testHover(docUri, new vscode.Position(294, 12), "class yesno: VSCodeExtJS.common.YesNo");
		await testHover(docUri, new vscode.Position(306, 13), "class yesno: VSCodeExtJS.common.YesNo");
	});


	test("Unknown strings", async () =>
	{
		//
		// Line 355
		// dataIndex: 'users.usertype'
		//
		await testHover(docUri, new vscode.Position(286, 12));
		await testHover(docUri, new vscode.Position(287, 25));
	});


	test("Unknown keywords", async () =>
    {
		await testHover(docUri, new vscode.Position(150, 3));
		await testHover(docUri, new vscode.Position(241, 16)); // "type: 'string'"" hits shouldIgnoreType()
		await testHover(docUri, new vscode.Position(135, 5));  // "return" hits shouldIgnoreType()
		await testHover(docUri, new vscode.Position(308, 10)); // labelField:
		await testHover(docUri, new vscode.Position(230, 16)); // someClass.someMethod();
    });


	test("Unknown variables / primitives", async () =>
	{   //
		// Line 145
		// let cmp = this.down('physiciandropdown');
		// THis should eventually work and this will be moved to instance variables test
		//
		await testHover(docUri, new vscode.Position(144, 8));
		//
		// Line 367
		// const xTestVar = "";
		//
		await testHover(docUri, new vscode.Position(366, 12));
		//
		// Line 368
		// let yTestVar = window.location;
		//
		await testHover(docUri, new vscode.Position(367, 10));
		//
		// Line 369
		// var zTestVar = someFunction();
		//
		await testHover(docUri, new vscode.Position(368, 10));
		//
		// Line 370
		// const xTestVar2 = "",
		//
		await testHover(docUri, new vscode.Position(369, 12));
		//
		// Line 371
		// yTestVar2 = window.location,
		//
		await testHover(docUri, new vscode.Position(370, 12));
		//
		// Line 372
		// zTestVar2 = someFunction();
		//
		await testHover(docUri, new vscode.Position(371, 12));
	});


	test("Store properties", async () =>
	{   //
		// Open non extjs doc inside of a classpath
		//
		const storeUri = getDocUri("app/shared/src/store/Activities.js");
		await activate(storeUri);
		//
		// Line 7
		// model: 'VSCodeExtJS.model.Activity'
		//
		await testHover(storeUri, new vscode.Position(6, 21), "model Activity: VSCodeExtJS.model.Activity");
		await testHover(storeUri, new vscode.Position(6, 26), "model Activity: VSCodeExtJS.model.Activity");
		await testHover(storeUri, new vscode.Position(6, 32), "model Activity: VSCodeExtJS.model.Activity");

		await waitForValidation();
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	});


	test("Non-ExtJS document", async () =>
	{   //
		// Open non extjs doc inside of a classpath
		//
		const jssUri = getDocUri("app/js/script1.js");
		await activate(jssUri);
		//
		// Line 145
		// let cmp = this.down('physiciandropdown');
		//
		await testHover(jssUri, new vscode.Position(5, 12));
		await waitForValidation();
		await closeActiveDocument();
		await waitForValidation();
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
