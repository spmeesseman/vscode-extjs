
import * as vscode from "vscode";
import * as completion from "./completion";
import { getDocUri, activate, waitForValidation, insertDocContent, toRange, closeActiveDocuments, closeActiveDocument } from "./helper";
import { configuration } from "../../common/configuration";


suite("Completion Tests", () =>
{

	const docUri = getDocUri("app/shared/src/app.js");
	const eolUri = getDocUri("app/shared/src/appEol.js");
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


	test("Config properties of extended class", async () =>
	{
		const physDdUri = getDocUri("app/classic/src/common/PhysicianDropdown.js");
		await activate(physDdUri);
		await completion.testCompletion(physDdUri, new vscode.Position(14, 0), "u", {
			items: [
				{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "config property of extended class");
		await completion.testCompletion(physDdUri, new vscode.Position(14, 0), "r", {
			items: [
				{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "config property of extended class");
		await insertDocContent("u", toRange(14, 1, 14, 1));
		await completion.testCompletion(physDdUri, new vscode.Position(14, 1), "s", {
			items: [
				{ label: "userName UserDropdown config", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "config property of extended class");
		await insertDocContent("r", toRange(14, 1, 14, 2));
		await completion.testCompletion(physDdUri, new vscode.Position(14, 1), "e", {
			items: [
				{ label: "readOnly UserDropdown", kind: vscode.CompletionItemKind.Property }
			]
		}, true, "config property of extended class");
		await insertDocContent("", toRange(14, 0, 14, 1));
		await closeActiveDocument();
	});


	test("No completion", async () =>
	{
		await completion.none(docUri);
		//
		// Open non extjs doc outside of a classpath
		//
		const jssUri = getDocUri("app/js/script1.js");
		await activate(jssUri);
		await completion.testCompletion(jssUri, new vscode.Position(4, 0), "A", {
			items: []
		}, true, "non-extjs file");
		await closeActiveDocument();
	});


	test("Non-ExtJS document", async () =>
	{
		await closeActiveDocument();
		const jssUri = getDocUri("app/js/script1.js");
		await activate(jssUri);
		await completion.testCompletion(jssUri, new vscode.Position(2, 12), ".", {
			items: []
		}, false, "non-extjs file");
		await closeActiveDocument();
	});

});
