
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "./helper";


suite("Definition Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
	});


	// test("Variable instance inherited methods", async () =>
	// {
	// 	//
	// 	// const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...)
	// 	// Line 83
	// 	// phys.delete(), inherited method from UserDropdown
	// 	//
	// 	// await testDefinition(docUri, new vscode.Position(82, 7), [
	// 	// {
	// 	// 	uri: vscode.Uri.file("app/classic/src/common/UserDropdown.js"),
	// 	// 	range: toRange(0, 0, 0, 0)
	// 	// }]);
	// });


	// test("Variable instance methods", async () =>
	// {
	// 	//
	// 	// const pin = phys.getPinNumber();
	// 	// Line 82
	// 	// phys.getPinNumber(), local method
	// 	//
	// 	// await testDefinition(docUri, new vscode.Position(81, 20), [
    //     // {
    //     //     uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
    //     //     range: toRange(33, 1, 36, 2)
    //     // }]);
	// });


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
			range: toRange(62, 4, 65, 5)
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


	test("Configs and Properties", async () =>
	{
		//
		// Line 68
		// console.log(this.test);
		//
		await testDefinition(docUri, new vscode.Position(67, 21), [
		{
			uri: getDocUri("app/shared/src/app.js"),
			range: toRange(27, 2, 27, 12)
		}]);
		//
		// Line 69
		// console.log(this.test3);
		//
		await testDefinition(docUri, new vscode.Position(68, 21), [
		{
			uri: getDocUri("app/shared/src/app.js"),
			range: toRange(18, 1, 18, 5)
		}]);
		//
		// Line 70 getter/setter
		// console.log(this.getTest());
		//
		await testDefinition(docUri, new vscode.Position(69, 21), [
        {
            uri: getDocUri("app/shared/src/app.js"),
            range: toRange(27, 2, 27, 6)
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

	// console.log("####################################");
	// console.log("Actual");
	// console.log("####################################");
	// actualDefinitions.forEach((d) => {
	// 	console.log("***********************");
	// 	console.log(d.uri.path);
	// 	console.log("***********************");
	// 	console.log(d.range.start.line);
	// 	console.log(d.range.start.character);
	// 	console.log(d.range.end.line);
	// 	console.log(d.range.end.character);
	// });
	// console.log("####################################");
	// console.log("Expected");
	// console.log("####################################");
	// expectedDefinitions.forEach((d) => {
	// 	console.log("***********************");
	// 	console.log(d.uri.path);
	// 	console.log("***********************");
	// 	console.log(d.range.start.line);
	// 	console.log(d.range.start.character);
	// 	console.log(d.range.end.line);
	// 	console.log(d.range.end.character);
	// });

	expectedDefinitions.forEach((expectedDefinition) => {

		assert.strictEqual(
            actualDefinitions.filter(item => item.uri.path === expectedDefinition.uri.path &&
				                             item.range.start.line === expectedDefinition.range.start.line).length,
            1, expectedDefinition.uri.path + " definition error"
        );
	});
}
