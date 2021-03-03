
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, waitForValidation, toRange } from "./helper";
import { assertTSConstructSignatureDeclaration } from "@babel/types";
import { toVscodeRange } from "../../common/clientUtils";


suite("Definition Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
	});


	test("Local inherited methods", async () =>
	{
		//
		// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
		// Line 83
		// phys.*
		//
		// await testDefinition(docUri, new vscode.Position(82, 7), [
        // {
        //     uri: vscode.Uri.file(""),
        //     range: toRange(0, 0, 0, 0)
        // }]);
	});


	test("Local methods", async () =>
	{
		//
		// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
		// Line 83
		// phys.*
		//
		// await testDefinition(docUri, new vscode.Position(82, 7), [
        // {
        //     uri: vscode.Uri.file(""),
        //     range: toRange(0, 0, 0, 0)
        // }]);
	});


    test("Classes", async () =>
    {
		//
		// Line 75-76
		// VSCodeExtJS
		//
		await testDefinition(docUri, new vscode.Position(74, 3), [
		{
			uri: getDocUri("app/shared/src/app.js"),
			range: toRange(0, 0, 0, 0)
		}]);
		//
		// app.js Line 75
		// PhysicianDropdown
		//
		await testDefinition(docUri, new vscode.Position(74, 22), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(0, 0, 0, 0)
		}]);
    });


	test("Class methods", async () =>
	{
		//
		// app.js Line 72
		// VSCodeExtJS.AppUtilities.alertError
		//
		await testDefinition(docUri, new vscode.Position(71, 27), [
		{
			uri: getDocUri("app/shared/src/AppUtilities.js"),
			range: toRange(63, 4, 66, 5)
		}]);
		//
		// app.js Line 75
		// PhysicianDropdown - phys.getPinNumber() - Instance method
		//
		// await testDefinition(docUri, new vscode.Position(81, 20), [
		// {
		// 	uri: getDocUri("app/classic/src/PhysicianDropdown.js"),
		// 	range: toRange(0, 0, 0, 0)
		// }]);
	});


	test("Sub-classes", async () =>
	{
		//
		// Line 72
		// VSCodeExtJS.AppUtilities
		//
		await testDefinition(docUri, new vscode.Position(71, 15), [
        {
            uri: getDocUri("app/shared/src/AppUtilities.js"),
            range: toRange(0, 0, 0, 0)
        }]);
	});

	test("xtypes", async () =>
	{
		//
		// Line 34 - app component
		// physiciandropdown
		//
		await testDefinition(docUri, new vscode.Position(33, 11), [
        {
            uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
            range: toRange(13, 9, 13, 28)
        }]);
		//
		// Line 43 - ext component
		// form (alias)
		//
		await testDefinition(docUri, new vscode.Position(42, 11), [
		{
			uri: getDocUri("extjs/ext-all-debug.js"),
			range: toRange(117895, 11, 117895, 24)
		}]);
		//
		// Line 44 - ext component
		// component (xtype)
		//
		await testDefinition(docUri, new vscode.Position(45, 11), [
		{
			uri: getDocUri("extjs/ext-all-debug.js"),
			range: toRange(37965, 8, 37965, 19)
		}]);
	});


	test("String literals", async () =>
	{
		//
		// Line 78
		// Ext.create("VSCodeExtJS.common.PhysicianDropdown"...
		//
		await testDefinition(docUri, new vscode.Position(77, 28), [
        {
            uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
            range: toRange(0, 0, 0, 0)
        }]);
		await testDefinition(docUri, new vscode.Position(77, 40), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(0, 0, 0, 0)
		}]);
		await testDefinition(docUri, new vscode.Position(77, 48), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(0, 0, 0, 0)
		}]);
		//
		// Lines 9-13
		// requires: [
		//     'VSCodeExtJS.AppUtilities',
		//     'VSCodeExtJS.common.PatientDropdown',
		//     'VSCodeExtJS.common.PhysicianDropdown'
		// ]
		//
		await testDefinition(docUri, new vscode.Position(9, 16), [
		{
			uri: getDocUri("app/shared/src/AppUtilities.js"),
			range: toRange(0, 0, 0, 0)
		}]);
		await testDefinition(docUri, new vscode.Position(10, 16), [
		{
			uri: getDocUri("app/classic/src/common/PatientDropdown.js"),
			range: toRange(0, 0, 0, 0)
		}]);
		await testDefinition(docUri, new vscode.Position(10, 25), [
		{
			uri: getDocUri("app/classic/src/common/PatientDropdown.js"),
			range: toRange(0, 0, 0, 0)
		}]);
	});

});


async function testDefinition(docUri: vscode.Uri, position: vscode.Position, expectedDefinitions: vscode.Location[])
{
	const actualDefinitions = (await vscode.commands.executeCommand(
		"vscode.executeDefinitionProvider",
		docUri,
		position
	)) as vscode.Location[];

	assert.ok(actualDefinitions.length >= expectedDefinitions.length);

	expectedDefinitions.forEach((expectedDefinition) => {

		assert.strictEqual(
            actualDefinitions.filter(item => item.uri.path === expectedDefinition.uri.path &&
				                             item.range.start.line === expectedDefinition.range.start.line).length,
            1, expectedDefinition.uri.fsPath + " definition error"
        );
	});
}
