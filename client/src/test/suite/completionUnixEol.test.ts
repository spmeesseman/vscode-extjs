
import * as vscode from "vscode";
import * as completion from "./completion";
import { getDocUri, activate, waitForValidation, closeActiveDocuments } from "./helper";
import { configuration } from "../../common/configuration";


suite("Completion Tests (Unix EOL)", () =>
{

	const docUri = getDocUri("app/shared/src/appEol.js");
	let quickSuggest: boolean | undefined;
	let ignoreErrors: any[];


	suiteSetup(async function()
    {
		await activate(docUri);
		//
		// Set `quick suggest` setting
		//
		const config = vscode.workspace.getConfiguration();
		quickSuggest = config.get<boolean>("editor.quickSuggestions");
		await config.update("editor.quickSuggestions", true);
		await waitForValidation();
		//
		// Set `ignore errors` setting
		//
		ignoreErrors = configuration.get<any[]>("ignoreErrors", []);
		await configuration.update("ignoreErrors", []);
		await waitForValidation();
	});


	suiteTeardown(async () =>
    {   //
		// Reset `quick suggest` setting
		//
		await vscode.workspace.getConfiguration().update("editor.quickSuggestions", quickSuggest);
		//
		// Reset `ignore errors` setting
		//
		await configuration.update("ignoreErrors", ignoreErrors);
		await waitForValidation();
		//
		// Close active documents
		//
		await closeActiveDocuments();
	});


	test("This methods", async () =>
	{
		await activate(docUri);
		await completion.thisMethod(docUri);
	});


	test("Inline class", async () =>
	{
		await completion.inlineClass(docUri);
	});


	test("Inline property", async () =>
	{
		await completion.inlineProperty(docUri);
	});


	test("Inline model field", async () =>
	{
		await completion.inlineModelField(docUri);
	});


	test("Class instance config properties", async () =>
	{
		await completion.instanceConfigProperties(docUri);
	});


	test("Local inherited methods", async () =>
	{
		await completion.localInheritedMethods(docUri);
	});


	test("Local class instances", async () =>
	{
		await completion.localClassInstances(docUri);
	});


	test("Statics block properties and methods", async () =>
	{
		await completion.statics(docUri);
	});


	test("Privates block properties and methods", async () =>
	{
		await completion.privates(docUri);
	});


	test("Inline class as a parameter", async () =>
	{
		await completion.inlineClassAsParam(docUri);
	});


	test("Sub-classes", async () =>
	{
		await completion.subClass(docUri);
	});


	test("Sub-class methods", async () =>
	{
		await completion.subClassMethods(docUri);
	});


	test("Invalid xtype object", async () =>
	{
		await completion.invalidXTypeObject(docUri);
	});


	test("Full xtype lines", async () =>
	{
		await completion.fullXTypeLines(docUri);
	});


	test("Full type lines", async () =>
	{
		await completion.fullTypeLines(docUri);
	});


	test("Object 'xtype' configs and properties", async () =>
	{
		await completion.xTypeProperties(docUri);
	});


	test("Object 'type' configs and properties", async () =>
	{
		await completion.typeProperties(docUri);
	});


	test("Property values", async () =>
	{
		await completion.propertyValues(docUri);
	});


	test("Behind comments", async () =>
	{
		await completion.behindComments(docUri);
	});


	test("No completion", async () =>
	{
		await completion.none(docUri);
	});

});
