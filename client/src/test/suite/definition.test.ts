
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, closeActiveDocument } from "./helper";


suite("Definition Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async function()
    {
		this.timeout(45 * 1000);
		await activate(docUri);
	});


	suiteTeardown(async () =>
    {
		await closeActiveDocument();
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
		// app.js Line 75
		// PhysicianDropdown
		//
		await testDefinition(docUri, new vscode.Position(74, 22), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(6, 0, 55, 2)
		}]);
		//
		// app.js Line 351
		// \t\tconst patient = new VSCodeExtJS.common.PatientDropdown();
		//
		await testDefinition(docUri, new vscode.Position(350, 45), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(6, 0, 55, 2)
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


	test("Sub classes", async () =>
	{
		//
		// Line 72
		// VSCodeExtJS."AppUtilities".alertError
		//
		await testDefinition(docUri, new vscode.Position(71, 15), [
        {
            uri: getDocUri("app/shared/src/AppUtilities.js"),
            range: toRange(7, 0, 67, 2)
        }]);
	});


	test("Base classes", async () =>
	{
		//
		// Line 72
		// "VSCodeExtJS".AppUtilities.alertError
		// Needs to use only start position for range in the case where the position is within
		// the component itself's range
		//
		await testDefinition(docUri, new vscode.Position(71, 3), [
        {
            uri: getDocUri("app/shared/src/app.js"),
            range: toRange(5, 0, 5, 0)
        }]);
		//
		// Line 75-76
		// VSCodeExtJS
		//
		await testDefinition(docUri, new vscode.Position(74, 3), [
		{
			uri: getDocUri("app/shared/src/app.js"),
			range: toRange(5, 0, 5, 0)
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

	test("Component xtypes", async () =>
	{
		//
		// Line 34 - app component
		// physiciandropdown
		//
		await testDefinition(docUri, new vscode.Position(33, 11), [
        {
            uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
            range: toRange(6, 0, 99, 2)
        }]);
		//
		// Line 43 - ext component
		// form (alias)
		//
		await testDefinition(docUri, new vscode.Position(42, 11), [
		{
			uri: getDocUri("extjs/ext-all-debug.js"),
			range: toRange(117889, 0, 118063, 2)
		}]);
		//
		// Line 44 - ext component
		// component (xtype)
		//
		await testDefinition(docUri, new vscode.Position(45, 11), [
		{
			uri: getDocUri("extjs/ext-all-debug.js"),
			range: toRange(37961, 0, 41225, 2)
		}]);
		// await testHover(docUri, new vscode.Position(45, 3), "component");
		//
		// Line 145
		// let cmp = this.down('physiciandropdown');
		//
		await testDefinition(docUri, new vscode.Position(144, 24), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(6, 0, 99, 2)
		}]);
		// await testHover(docUri, new vscode.Position(45, 3), "component");
		//
		// Line 157
		// xtype: "physiciandropdown"
		//
		await testDefinition(docUri, new vscode.Position(156, 16), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(6, 0, 99, 2)
		}]);
	});


	test("Store types", async () =>
	{
		//
		// Line 202
		// type: "users"
		// Is of type VSCodeExtJS.store.user.Users, not VSCodeExtJS.view.users.Users, which
		// is also of (x)type "users"
		//
		await testDefinition(docUri, new vscode.Position(201, 13), [
		{
			uri: getDocUri("app/shared/src/store/user/Users.js"),
			range: toRange(1, 0, 47, 2)
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
            range: toRange(6, 0, 55, 2)
        }]);
		await testDefinition(docUri, new vscode.Position(77, 40), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(6, 0, 55, 2)
		}]);
		await testDefinition(docUri, new vscode.Position(77, 48), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(6, 0, 55, 2)
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
			range: toRange(7, 0, 67, 2)
		}]);
		await testDefinition(docUri, new vscode.Position(10, 16), [
		{
			uri: getDocUri("app/classic/src/common/PatientDropdown.js"),
			range: toRange(0, 0, 4, 2)
		}]);
		await testDefinition(docUri, new vscode.Position(10, 25), [
		{
			uri: getDocUri("app/classic/src/common/PatientDropdown.js"),
			range: toRange(0, 0, 4, 2)
		}]);
	});


	test("No definition", async () =>
    {   //
		// app.js Line 151
		// me.test3 = AppUtils.alertError("test");
		// 'me' is not set
		//
		await testDefinition(docUri, new vscode.Position(150, 3), []);
		await testDefinition(docUri, new vscode.Position(241, 16), []); // "type: 'string'"" hits shouldIgnoreType()
		await testDefinition(docUri, new vscode.Position(230, 16), []); // someClass.someMethod();
		//
		// Line 292
		// text: 'test2',
		//
		await testDefinition(docUri, new vscode.Position(291, 12), []); // no controller method, no nothing
    });


	test("Methods defined in controller", async () =>
	{
		const gridUri = getDocUri("app/classic/src/view/users/Grid.js");
		await activate(gridUri);
		//
		// Line 73
		// handler: 'onOkClick'
		//
		await testDefinition(gridUri, new vscode.Position(72, 26), [
		{
			uri: getDocUri("app/classic/src/view/users/GridController.js"),
			range: toRange(37, 4, 40, 6)
		}]);
		//
		// Line 65
		// afterrender: 'onAfterRender'
		//
		await testDefinition(gridUri, new vscode.Position(64, 26), [
		{
			uri: getDocUri("app/classic/src/view/users/GridController.js"),
			range: toRange(30, 4, 34, 6)
		}]);
		await closeActiveDocument();
		//
		// Line 106
		// Nothing
		// xtype : 'datecolumn'
		//
		await testDefinition(gridUri, new vscode.Position(105, 22), []);
		await closeActiveDocument();
	});


	test("Non-ExtJS document", async () =>
	{
		const jssUri = getDocUri("app/js/script1.js");
		await activate(jssUri);
		await testDefinition(jssUri, new vscode.Position(1, 11), []);
		await closeActiveDocument();
	});

});


async function testDefinition(docUri: vscode.Uri, position: vscode.Position, expectedDefinitions: vscode.Location[])
{
	const actualDefinitions = (await vscode.commands.executeCommand(
		"vscode.executeDefinitionProvider",
		docUri,
		position
	)) as vscode.Location[];

	// console.log("####################################");
	// console.log(docUri.path);
	// console.log("####################################");
	// console.log("Actual");
	// console.log("####################################");
	// actualDefinitions.forEach((d) => {
	// 	console.log("***********************");
	// 	console.log(d.uri.path);
	// 	console.log("***********************");
	// 	console.log("sLine: " + d.range.start.line);
	// 	console.log("sChar: " + d.range.start.character);
	// 	console.log("eLine: " + d.range.end.line);
	// 	console.log("eChar: " + d.range.end.character);
	// });
	// console.log("####################################");
	// console.log("Expected");
	// console.log("####################################");
	// expectedDefinitions.forEach((d) => {
	// 	console.log("***********************");
	// 	console.log(d.uri.path);
	// 	console.log("***********************");
	// 	console.log("sLine: " + d.range.start.line);
	// 	console.log("sChar: " + d.range.start.character);
	// 	console.log("eLine: " + d.range.end.line);
	// 	console.log("eChar: " + d.range.end.character);
	// });

	assert.ok(actualDefinitions);
	assert.ok(expectedDefinitions);

	expectedDefinitions.forEach((expectedDefinition) =>
	{
		const actualFiltered = actualDefinitions.filter(item => item.uri.path === expectedDefinition.uri.path &&
							   item.range.start.line === expectedDefinition.range.start.line);
		assert.strictEqual(actualFiltered.length, expectedDefinitions.length);
	});
}
