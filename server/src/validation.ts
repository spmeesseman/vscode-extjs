
import { Connection, Diagnostic, DiagnosticSeverity, Range, DocumentUri } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseExtJsFile, componentClassToWidgetsMapping, widgetToComponentClassMapping } from "./syntaxTree";
import { IPosition, IComponent, utils, ErrorCode, IRequire, IRequires, IUses } from "../../common";
import { globalSettings } from "./server";
import { URI } from "vscode-uri";
import * as log from "./log";


function isErrorIgnored(code: number, fsPath: string): boolean
{
	if (!globalSettings.ignoreErrors || globalSettings.ignoreErrors.length === 0) {
		return false;
	}

	for (const iError of globalSettings.ignoreErrors)
	{
		if (iError.code === code) {
			if (!fsPath || !iError.fsPath || iError.fsPath === fsPath) {
				return true;
			}
		}
	}

	return false;
}


/**
 * @method validateExtJsDocument
 *
 * Validates non-indexed component related items w/o interaction from the client
 *
 * @param textDocument {TextDocument} VSCode TextDOcument object
 * @param connection Client connection object
 * @param diagRelatedInfoCapability Specifies if the client has diagnostic related information capability
 */
export async function validateExtJsDocument(textDocument: TextDocument, connection: Connection, diagRelatedInfoCapability: boolean, sendToClient?: boolean): Promise<Diagnostic[]>
{
	const text = textDocument.getText(),
		  diagnostics: Diagnostic[] = [];
/*
	if (!isErrorIgnored(ErrorCode.syntaxAllCaps, textDocument.uri))
	{
		const pattern = /\b[A-Z]{2,}\b/g;
		let m: RegExpExecArray | null;

		let problems = 0;
		while ((m = pattern.exec(text)) && problems < 5)
		{
			problems++;
			const diagnostic: Diagnostic =
			{
				severity: DiagnosticSeverity.Warning,
				range: {
					start: textDocument.positionAt(m.index),
					end: textDocument.positionAt(m.index + m[0].length)
				},
				message: `${m[0]} is all uppercase.`,
				source: "vscode-extjs",
				code: ErrorCode.syntaxAllCaps
			};

			if (diagRelatedInfoCapability)
			{
				diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: { ...diagnostic.range }
					},
					message: "Casing matters, don't do it!!"
				}];
			}

			diagnostics.push(diagnostic);
		}

		if (sendToClient !== false) {
			connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
		}
	}
*/
	return diagnostics;
}


/**
 * @method validateExtJsFile
 *
 * Validates indexed component related items w/ interaction from the client
 *
 * @param options.fsPath File path
 * @param options.nameSpace ExtJs file namespace
 * @param options.text Fle text
 * @param connection Client connection object
 * @param diagRelatedInfoCapability Specifies if the client has diagnostic related information capability
 */
export async function validateExtJsFile(options: any, connection: Connection, diagRelatedInfoCapability: boolean)
{
	log.methodStart("validate extjs file text", 1, "", true);

	const components = await parseExtJsFile(options.path, options.text, options.project, options.nameSpace);
	const diagnostics: Diagnostic[] = [];
	const textObj = TextDocument.create(options.path, "javascript", 2, options.text);

	//
	// For each component found, perform the following validations:
	//
	//     1. xTypes
	//     1. Method variables
	//
	components?.forEach(cmp =>
	{
		//
		// Validate xtypes
		//
		if (globalSettings.validateXTypes)
		{
			cmp.widgets.filter(w => w.type !== "alias").forEach((w) => {
				validateXtype(w.type, w.name, cmp, toVscodeRange(w.start, w.end), diagRelatedInfoCapability, textObj, diagnostics);
			});
		}

		//
		// Validate requires array
		//
		validateRequiredClasses(cmp.requires, cmp, diagRelatedInfoCapability, textObj, diagnostics);

		//
		// Validate uses array
		//
		validateRequiredClasses(cmp.uses, cmp, diagRelatedInfoCapability, textObj, diagnostics);

		//
		// Validate method variables
		//
		for (const method of cmp.methods)
		{
			log.value("   check method", method.name, 3);

			if (method.variables)
			{
				for (const variable of method.variables)
				{
					log.value("      check variable ", variable.name, 3);
				}
			}
		}
	});

	//
	// General syntax processing
	//
	const locDiag = await validateExtJsDocument(textObj, connection, diagRelatedInfoCapability, false);
	if (locDiag.length > 0) {
		diagnostics.push(...locDiag);
	}

	//
	// Send the diagnostics to the client, if any
	//
	connection.sendDiagnostics({ uri: textObj.uri, diagnostics });


	log.methodDone("validate extjs file text", 1, "", true);
}


function toVscodePosition(position: IPosition)
{
    const { line, column } = position;
	return {
		line: line - 1,
		character: column
	};
}


function toVscodeRange(start: IPosition, end: IPosition): Range
{
	return {
		start: toVscodePosition(start),
		end: toVscodePosition(end)
	};
}


function validateXtype(propertyName: string, xtype: string, cmp: IComponent, range: Range, diagRelatedInfoCapability: boolean, document: TextDocument, diagnostics: Diagnostic[])
{
	const cmpRequires = cmp.requires,
		  xtypeId = (propertyName === "type" ? "store." + xtype : xtype).replace("widget.", ""),
		  thisWidgetCls = widgetToComponentClassMapping[cmp.nameSpace][xtypeId] || widgetToComponentClassMapping.Ext[xtypeId],
		  fsPath = URI.file(document.uri).fsPath,
		  eNotFoundCode = propertyName === "type" ? ErrorCode.typeNotFound : ErrorCode.xtypeNotFound,
		  eNoRequiresCode = propertyName === "type" ? ErrorCode.typeNoRequires : ErrorCode.xtypeNoRequires;

	//
	// Check ignored line (previous line), e.g.:
	//
	//     /** vscode-extjs-ignore-3 */
	//     xtype: 'userdropdown'
	//
	const ignoreRange = {
		start: {
			line: range.start.line - 1,
			character: 0
		},
		end: {
			line: range.start.line - 1,
			character: 100000
		}
	};
	let ignoreText = document.getText(ignoreRange);
	if (ignoreText.includes("/** vscode-extjs-ignore-")) {
		ignoreText = ignoreText.substring(ignoreText.indexOf("/** vscode-extjs-ignore-")).trimEnd();
	}

	//
	// First check to make sure we have the widget/xtype/alias indexed
	//
	if (!thisWidgetCls && ignoreText !== `/** vscode-extjs-ignore-${eNotFoundCode} */`)
	{   //
		// Check global/file ignore for this error type
		//
		let ignore = false;
		if (globalSettings.ignoreErrors && globalSettings.ignoreErrors.length > 0) {
			for (const iErr of globalSettings.ignoreErrors) {
				if (iErr.code === eNotFoundCode) {
					if (!iErr.fsPath || fsPath === iErr.fsPath) {
						ignore = true;
						break;
					}
				}
			}
		}

		if (!ignore)
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range,
				message: `The referenced ${propertyName} "${xtype}" was not found.`,
				source: "vscode-extjs",
				code: eNotFoundCode
			};

			if (diagRelatedInfoCapability) {
				addSuggestions(diagnostic, xtype, document, widgetToComponentClassMapping);
			}

			diagnostics.push(diagnostic);
		}
	}

	if (utils.isNeedRequire(thisWidgetCls, componentClassToWidgetsMapping) && ignoreText !== `/** vscode-extjs-ignore-${eNoRequiresCode} */`)
	{   //
		// Check global/file ignore for this error type
		//
		let ignore = false;
		if (globalSettings.ignoreErrors && globalSettings.ignoreErrors.length > 0) {
			for (const iErr of globalSettings.ignoreErrors) {
				if (iErr.code === eNoRequiresCode) {
					if (!iErr.fsPath || fsPath === iErr.fsPath) {
						ignore = true;
						break;
					}
				}
			}
		}

		if (!ignore)
		{
			const requires = [],
				  requiredXtypes: string[] = [];
			let thisXType: string | undefined;
			requires.push(...(cmpRequires?.value || []));

			//
			// Ignore if this is the defined xtype of the component itself
			//
			if (thisWidgetCls === cmp.componentClass) {
				requiredXtypes.push(xtype);
			}
			else if (requires.length > 0)
			{
				const requiredXtypes: string[] = [];
				for (const require of requires)
				{
					if (require.name !== thisWidgetCls) {
						requiredXtypes.push(...(componentClassToWidgetsMapping[cmp.nameSpace][require.name] || componentClassToWidgetsMapping.Ext[require.name] || []));
					}
					else {
						thisXType = xtype;
					}
				}
			}

			if (!requiredXtypes.includes(xtype) && xtype !== thisXType)
			{
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Warning,
					range,
					message: `The referenced ${propertyName} "${xtype}" does not have a corresponding requires directive.`,
					source: "vscode-extjs",
					code: eNoRequiresCode
				};
				diagnostics.push(diagnostic);
			}
		}
	}

}


function validateRequiredClasses(cmpRequires: IRequires | IUses | undefined, cmp: IComponent, diagRelatedInfoCapability: boolean, document: TextDocument, diagnostics: Diagnostic[])
{
	if (!cmpRequires) {
		return;
	}

	const requires: IRequire[] = [],
		  fsPath = URI.file(document.uri).fsPath;

	requires.push(...(cmpRequires?.value || []));

	//
	// Check global/file ignore for this error type
	//
	if (globalSettings.ignoreErrors && globalSettings.ignoreErrors.length > 0) {
		for (const iErr of globalSettings.ignoreErrors) {
			if (iErr.code === ErrorCode.classNotFound) {
				if (!iErr.fsPath || fsPath === iErr.fsPath) {
					return;
				}
			}
		}
	}

	for (const require of requires)
	{
		const thisWidgetCls = componentClassToWidgetsMapping[cmp.nameSpace][require.name] || componentClassToWidgetsMapping.Ext[require.name] ||
		                      widgetToComponentClassMapping[cmp.nameSpace][require.name] || widgetToComponentClassMapping.Ext[require.name];
		if (thisWidgetCls) { // if we have a mapping, then no diagnostic
			continue;
		}
		//
		// Check ignored line (previous line), e.g.:
		//
		//     /** vscode-extjs-ignore-3 */
		//     xtype: 'userdropdown'
		//
		const ignoreRange = {
			start: {
				line: require.start ? require.start.line - 1 : cmpRequires.start.line - 1,
				character: 0
			},
			end: {
				line: require.end ? require.end.line - 1 : cmpRequires.end.line - 1,
				character: 100000
			}
		};
		let ignoreText = document.getText(ignoreRange);
		if (ignoreText.includes("/** vscode-extjs-ignore-")) {
			ignoreText = ignoreText.substring(ignoreText.indexOf("/** vscode-extjs-ignore-")).trimEnd();
		}

		if (ignoreText !== `/** vscode-extjs-ignore-${ErrorCode.xtypeNoRequires} */`)
		{
			const range = toVscodeRange(require.start || cmpRequires.start, require.end || cmpRequires.end);
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range,
				message: "No corresponding class definition found.",
				source: "vscode-extjs",
				code: ErrorCode.classNotFound
			};
			if (diagRelatedInfoCapability) {
				addSuggestions(diagnostic, require.name, document, componentClassToWidgetsMapping);
			}
			diagnostics.push(diagnostic);
		}
	}
}


function addSuggestions(diagnostic: Diagnostic, text: string, document: TextDocument, mapping: { [nameSpace: string]: { [widget: string]:  (string[]|string) | undefined }})
{
	const suggestions: string[] = [];
	//
	// See if some suggestions can be made...
	//
	for (const nameSpace in mapping)
	{
		for (const component in mapping[nameSpace])
		{   //
			// Don''t expect the user to misspell by more than a character or two, so apply
			// a 2 character threshold on the length of the strings that we should compare
			//
			if (component.length < text.length - 2 || component.length > text.length + 2) {
				continue;
			}
			const componentPart1 = component.substring(0, component.length / 2),
				componentPart2 = component.substring(component.length / 2),
				textPart1 = text.substring(0, text.length / 2),
				textPart2 = text.substring(text.length / 2);

			if (component.indexOf(text) === 0) {
				suggestions.push(component);
			}
			else if (text.indexOf(component) === 0) {
				suggestions.push(component);
			}
			else if (text.match(new RegExp(`${componentPart1}[\\w]+`))) {
				suggestions.push(component);
			}
			else if (text.match(new RegExp(`[\\w]+${componentPart2}`))) {
				suggestions.push(component);
			}
			else if (component.match(new RegExp(`${textPart1}[\\w]+`))) {
				suggestions.push(component);
			}
			else if (component.match(new RegExp(`[\\w]+${textPart2}`))) {
				suggestions.push(component);
			}
			//
			// Max 5 suggestions
			//
			if (suggestions.length >= 5) {
				break;
			}
		}
	}

	if (suggestions.length > 0)
	{
		diagnostic.relatedInformation = [
		{
			location: {
				uri: document.uri,
				range: { ...diagnostic.range }
			},
			message: "Did you mean: " + suggestions.join(", ")
		}];
	}
}
