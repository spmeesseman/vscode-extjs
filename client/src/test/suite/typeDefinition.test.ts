
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange, waitForValidation, closeActiveDocuments, closeActiveDocument } from "./helper";


suite("Type Definition Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
	});


	suiteTeardown(async () =>
    {
		await closeActiveDocuments();
	});


	test("Store types", async () =>
	{
		//
		// Line 202
		// type: "users"
		// Is of type VSCodeExtJS.store.user.Users, not VSCodeExtJS.view.users.Users, which
		// is also of (x)type "users"
		//
		await testTypeDefinition(docUri, new vscode.Position(201, 13), [
		{
			uri: getDocUri("app/shared/src/store/user/Users.js"),
			range: toRange(1, 0, 47, 2)
		}]);
	});


	test("Function instance variables", async () =>
	{
		//
		// phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown"...
		// Line 83
		// phys.delete(), 'phys' as local instance variable
		//
		await testTypeDefinition(docUri, new vscode.Position(82, 3), [
        {
            uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
            range: toRange(6, 0, 55, 2)
        }]);
		//
		// const phys2 = new VSCodeExtJS.common.PhysicianDropdown(...
		// Line 89
		// phys.delete(), 'phys' as local instance variable
		//
		await testTypeDefinition(docUri, new vscode.Position(88, 3), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(6, 0, 55, 2)
		}]);
		//
		// const phys3 = VSCodeExtJS.common.PhysicianDropdown.create(...
		// Line 95
		// phys.delete(), 'phys' as local instance variable
		//
		await testTypeDefinition(docUri, new vscode.Position(94, 3), [
		{
			uri: getDocUri("app/classic/src/common/PhysicianDropdown.js"),
			range: toRange(6, 0, 55, 2)
		}]);
	});


	test("No type definition", async () =>
    {
		//
		// app.js Line 151
		// me.test3 = AppUtils.alertError("test");
		// 'me' is not set
		//
		await testTypeDefinition(docUri, new vscode.Position(150, 3), []);
		await testTypeDefinition(docUri, new vscode.Position(241, 16), []); // "type: 'string'"" hits shouldIgnoreType()
		await testTypeDefinition(docUri, new vscode.Position(230, 16), []); // someClass.someMethod();
    });


	test("Non-ExtJS document", async () =>
	{
		const jssUri = getDocUri("app/js/script1.js");
		await activate(jssUri);
		await testTypeDefinition(jssUri, new vscode.Position(1, 11), []);
		await closeActiveDocument();
	});

});


async function testTypeDefinition(docUri: vscode.Uri, position: vscode.Position, expectedDefinitions: vscode.Location[])
{
	const actualDefinitions = (await vscode.commands.executeCommand(
		"vscode.executeTypeDefinitionProvider",
		docUri,
		position
	)) as vscode.Location[];

	assert.ok(actualDefinitions.length >= expectedDefinitions.length);

	expectedDefinitions.forEach((expectedDefinition) => {

		assert.strictEqual(
            actualDefinitions.filter(item => item.uri.path === expectedDefinition.uri.path &&
				                             item.range.start.line === expectedDefinition.range.start.line).length,
            1, expectedDefinition.uri.path + " definition error"
        );
	});
}
