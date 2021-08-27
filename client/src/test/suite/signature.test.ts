
import * as vscode from "vscode";
import * as assert from "assert";
import { configuration } from "../../common/configuration";
import { getDocUri, activate, insertDocContent, toRange, waitForValidation } from "./helper";


suite("Method Signature Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	let validationDelay: number | undefined;


	suiteSetup(async () =>
    {   //
		// Set debounce to minimum for test
		//
		validationDelay = configuration.get<number>("validationDelay");
		await configuration.update("validationDelay", 250); // set to minimum validation delay
		await activate(docUri);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {   //
		// Reset validation delay setting back to original value
		//
		await configuration.update("validationDelay", validationDelay || 1250);
		await waitForValidation();
		try {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		}
		catch {}
		await waitForValidation();
	});


	test("Class singleton methods", async () =>
	{
		//
		// Line 71
		// VSCodeExtJS.AppUtilities.alertError
		//
		await testSignature(docUri, new vscode.Position(71, 38), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
		});

		//
		// Insert a first parameter, and trigger the signature helper again, we should then be
		// on parameter #2...
		//
		await insertDocContent("\"me\",", toRange(71, 38, 71, 38));
		await waitForValidation();

		await testSignature(docUri, new vscode.Position(71, 43), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
		});

		await insertDocContent("", toRange(71, 38, 71, 43));
		await waitForValidation();
	});



	test("Class alias singleton methods", async () =>
	{
		//
		// Line 72
		// AppUtils.alertError
		//
		await testSignature(docUri, new vscode.Position(72, 22), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
		});

		//
		// Insert a first parameter, and trigger the signature helper again, we should then be
		// on parameter #2...
		//
		await insertDocContent("\"me\",", toRange(72, 22, 72, 22));
		await waitForValidation();

		await testSignature(docUri, new vscode.Position(72, 27), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("msg, code, showHelpDeskBtn, helpType, fn")
		});

		await insertDocContent("", toRange(72, 22, 72, 27));
		await waitForValidation();
	});


	test("Class static methods", async () =>
	{
		//
		// Line 193
		// VSCodeExtJS.common.PhysicianDropdown.stopAll("Test", false, false)
		//
		await testSignature(docUri, new vscode.Position(192, 47), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("defaultName, force, exitOnError")
		});

		//
		// Insert a first parameter, and trigger the signature helper again, we should then be
		// on parameter #2...
		//
		await insertDocContent("\"me\",", toRange(192, 47, 192, 47));
		await waitForValidation();

		await testSignature(docUri, new vscode.Position(192, 52), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("defaultName, force, exitOnError")
		});

		await insertDocContent("", toRange(192, 47, 192, 52));
		await waitForValidation();
	});


	test("Class private methods", async () =>
	{
		const incPrivate = configuration.get<boolean>("intellisenseIncludePrivate");
		await configuration.update("intellisenseIncludePrivate", true);

		//
		// Line 229
		// VSCodeExtJS.common.PhysicianDropdown.stopAllPriv();
		//
		await testSignature(docUri, new vscode.Position(228, 51), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("defaultName, force, exitOnError")
		});
		//
		// Insert a first parameter, and trigger the signature helper again, we should then be
		// on parameter #2...
		//
		await insertDocContent("\"me\",", toRange(228, 51, 228, 51));
		await waitForValidation();

		await testSignature(docUri, new vscode.Position(228, 56), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("defaultName, force, exitOnError")
		});

		await insertDocContent("", toRange(228, 51, 228, 56));
		await waitForValidation();

		await configuration.update("intellisenseIncludePrivate", incPrivate);
	});


	test("Method as a parameter", async () =>
	{
		//
		// Line 109
		// me.testFn2();
		// Insert a first parameter that will be a function call
		//
		await insertDocContent("me.testFn4()", toRange(108, 13, 108, 13));
		await waitForValidation();

		//
		// Line 109
		// me.testFn2(me.testFn4(...
		//
		await testSignature(docUri, new vscode.Position(108, 24), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		});
		//
		// Insert a first parameter, and trigger the signature helper again, we should then be
		// on parameter #2...
		//
		await insertDocContent("\"me\",", toRange(108, 24, 108, 24));
		await waitForValidation();

		//
		// 2nd parameter
		//
		await testSignature(docUri, new vscode.Position(108, 29), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		});

		//
		// Remove added text, set document back to initial state
		//
		await insertDocContent("", toRange(108, 13, 108, 30));
		await waitForValidation();
	});


	test("No signature", async () =>
    {
		await testSignature(docUri, new vscode.Position(222, 1), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		}, false);

		//
		// Line 230
		// someMethod();
		//
		await testSignature(docUri, new vscode.Position(229, 13), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		}, false);
		//
		// Insert a first parameter, and trigger the signature helper again
		//
		await insertDocContent("\"me\",", toRange(229, 13, 229, 13));
		await waitForValidation();
		await testSignature(docUri, new vscode.Position(229, 18), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		}, false);
		await insertDocContent("", toRange(229, 13, 229, 18));
		await waitForValidation();

		//
		// Line 231
		// someClass.someMethod();
		//
		await testSignature(docUri, new vscode.Position(230, 23), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		}, false);
		//
		// Insert a first parameter, and trigger the signature helper again
		//
		await insertDocContent("\"me\",", toRange(230, 23, 230, 23));
		await waitForValidation();
		await testSignature(docUri, new vscode.Position(230, 28), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		}, false);
		await insertDocContent("", toRange(230, 23, 230, 28));
		await waitForValidation();

		//
		// Line 229
		// VSCodeExtJS.common.PhysicianDropdown.badFnToCall();
		//
		await testSignature(docUri, new vscode.Position(231, 51), "(", {
			activeParameter: 0,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		}, false);
		//
		// Insert a first parameter, and trigger the signature helper again, we should then be
		// on parameter #2...
		//
		await insertDocContent("\"me\",", toRange(231, 51, 231, 51));
		await waitForValidation();

		await testSignature(docUri, new vscode.Position(231, 56), ",", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		}, false);

		await insertDocContent("", toRange(231, 51, 231, 56));
		await waitForValidation();
    });


	test("Non-ExtJS document", async () =>
	{
		const jssUri = getDocUri("app/js/script1.js");
		try {
			const doc = await vscode.workspace.openTextDocument(jssUri);
			await vscode.window.showTextDocument(doc);
			assert(vscode.window.activeTextEditor, "No active editor");
		}
		catch (e) {
			console.error(e);
		}
		await waitForValidation();
		await testSignature(docUri, new vscode.Position(2, 16), "(", {
			activeParameter: 1,
			activeSignature: 0,
			signatures: getSigInfo("a, b")
		}, false);
		try {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		}
		catch {}
		await waitForValidation();
	});

});


function getSigInfo(sigLine: string): vscode.SignatureInformation[]
{
	const sigInfo = new vscode.SignatureInformation(sigLine),
		  params = sigLine.split(",");
	for (const p of params)
	{
		sigInfo.parameters.push(new vscode.ParameterInformation(p.trim()));
	}
	return [ sigInfo ];
}


async function testSignature(docUri: vscode.Uri, position: vscode.Position, triggerChar: string, expectedSignatureHelp: vscode.SignatureHelp, shouldHave = true)
{
	const actualSignatureHelp = (await vscode.commands.executeCommand(
		"vscode.executeSignatureHelpProvider",
		docUri,
		position,
		triggerChar
	)) as vscode.SignatureHelp;

	assert.ok(shouldHave ? actualSignatureHelp.signatures.length >= expectedSignatureHelp.signatures.length :
						   actualSignatureHelp.signatures.length <= expectedSignatureHelp.signatures.length);
	assert.ok(shouldHave ? actualSignatureHelp.activeParameter === expectedSignatureHelp.activeParameter : true);
	assert.ok(shouldHave ? actualSignatureHelp.activeSignature === expectedSignatureHelp.activeSignature : true);

	expectedSignatureHelp.signatures.forEach((expectedItem, i) =>
	{
		let found = false;
		actualSignatureHelp.signatures.forEach((actualItem) => {
			if (actualItem.label === expectedItem.label) {
				assert.ok(actualItem.parameters.length === expectedItem.parameters.length);
				expectedItem.parameters.forEach((expectedParam, j) =>
				{
					const actualParam = actualItem.parameters[j];
					assert.ok(actualParam.label === expectedParam.label);
				});
				found = true;
			}
		});
		assert.strictEqual(found, shouldHave);
	});
}
