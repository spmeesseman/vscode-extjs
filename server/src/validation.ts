
import { Connection, Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseExtJsFile, componentClassToWidgetsMapping, widgetToComponentClassMapping } from "./syntaxTree";
import { IPosition, IRequires, utils, ErrorCode } from "../../common";
import { globalSettings } from "./server";
import * as log from "./log";


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
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
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
			source: "vscode-extjs"
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

	return diagnostics;
}


/**
 * @method validateExtJsFile
 *
 * Validates indexed component related items w/ interaction from the client
 *
 * @param options.uriPath VSCode TextDOcument object
 * @param options.nameSpace ExtJs file namespace
 * @param options.text VSCode TextDOcument object
 * @param connection Client connection object
 * @param diagRelatedInfoCapability Specifies if the client has diagnostic related information capability
 */
export async function validateExtJsFile(options: any, connection: Connection, diagRelatedInfoCapability: boolean)
{
	const components = await parseExtJsFile(options.uriPath, options.text);
	const diagnostics: Diagnostic[] = [];
	const textObj = TextDocument.create(options.uriPath, "javascript", 2, options.text);

	log.methodStart("validate extjs file text", 1, "", true);

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
			for (const xtype of cmp.xtypes) {
				validateXtype(xtype.name, cmp.requires, toVscodeRange(xtype.start, xtype.end), diagRelatedInfoCapability, textObj, diagnostics);
			}
		}

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


function validateXtype(xtype: string, cmpRequires: IRequires | undefined, range: Range, diagRelatedInfoCapability: boolean, document: TextDocument, diagnostics: Diagnostic[])
{
	//
	// First check to make sure we have the widget/xtype/alias indexed
	//
	if (!widgetToComponentClassMapping[xtype])
	{
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range,
			message: `The referenced xtype "${xtype}" was not found.`,
			source: "vscode-extjs",
			code: ErrorCode.xtypeNotFound
		};

		if (diagRelatedInfoCapability)
		{
			const suggestions: string[] = [];
			//
			// See if some suggestions can be made...
			//
			for (const widget in widgetToComponentClassMapping)
			{   //
				// Don''t expect the user to misspell by more than a character or two, so apply
				// a 2 character threshhold on the length of the strings that we should compare
				//
				if (widget.length < xtype.length - 2 || widget.length > xtype.length + 2) {
					continue;
				}
				const widgetPart1 = widget.substring(0, widget.length / 2),
					widgetPart2 = widget.substring(widget.length / 2);
				//
				// Max 5 suggestions
				//
				if (suggestions.length === 5) {
					break;
				}
				if (xtype.match(new RegExp(`${widgetPart1}[\\w]+`))) {
					suggestions.push(widget);
					continue;
				}
				if (xtype.match(new RegExp(`[\\w]+${widgetPart2}`))) {
					suggestions.push(widget);
					continue;
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

			diagnostics.push(diagnostic);
		}
	}

	if (utils.isNeedRequire(widgetToComponentClassMapping[xtype]))
	{
		const requires = [];
		requires.push(...(cmpRequires?.value || []));
		const requiredXtypes = requires.reduce<string[]>((previousValue, currentCmpClass) => {
			previousValue.push(...(componentClassToWidgetsMapping[currentCmpClass] || []));
			return previousValue;
		}, []);

		if (!requiredXtypes.includes(xtype))
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range,
				message: `The referenced xtype "${xtype}" does not have a corresponding requires directive.`,
				source: "vscode-extjs",
				code: ErrorCode.xtypeNoRequires
			};
	/*
			if (diagRelatedInfoCapability)
			{
				diagnostic.relatedInformation = [
				{
					location: {
						uri: document.uri,
						range: { ...diagnostic.range }
					},
					message: xtype
				}];
			}
	*/
			diagnostics.push(diagnostic);
		}
	}

}
