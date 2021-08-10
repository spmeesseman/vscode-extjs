
import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate, toRange } from "./helper";


suite("Type Definition Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");


	suiteSetup(async () =>
    {
		await activate(docUri);
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
