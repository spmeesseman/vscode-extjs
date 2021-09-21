
import { Connection, Diagnostic, DiagnosticSeverity, Range, DocumentUri } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseExtJsFile, components } from "./parser";
import { IPosition, IComponent, utils, ErrorCode, IRequire, IRequires, IUses, extjs, IWidget, IExtJsBase, IMixins, IProperty, IServerRequest } from "../../common";
import { globalSettings } from "./server";
import { URI } from "vscode-uri";
import * as log from "./lib/log";
import { toVscodeRange } from "./lib/serverUtils";


const validateProperties = [ "model", "extend" ];


function getIgnoreText(widget: IWidget | IRequire, document: TextDocument)
{   //
	// Check ignored line (previous line), e.g.:
	//
	//     /** vscode-extjs-ignore-3 */
	//     xtype: 'userdropdown'
	//
	const ignoreRange = {
		start: {
			line: widget.start.line - 1,
			character: 0
		},
		end: {
			line: widget.end.line - 1,
			character: 100000
		}
	};
	let ignoreText = document.getText(ignoreRange);
	if (ignoreText.includes("/** vscode-extjs-ignore-")) {
		ignoreText = ignoreText.substring(ignoreText.indexOf("/** vscode-extjs-ignore-")).trimEnd();
	}

	return ignoreText;
}


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


function isIgnoredGlobal(fsPath: string)
{   //
	// Check global/file ignore for this error type
	//
	if (globalSettings.ignoreErrors && globalSettings.ignoreErrors.length > 0) {
		for (const iErr of globalSettings.ignoreErrors) {
			if (iErr.code === ErrorCode.classNotFound) {
				if (!iErr.fsPath || fsPath === iErr.fsPath) {
					return true;
				}
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
export async function validateExtJsSyntax(textDocument: TextDocument, connection: Connection, diagRelatedInfoCapability: boolean, sendToClient?: boolean): Promise<Diagnostic[]>
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
export async function validateExtJsFile(options: IServerRequest, connection: Connection, diagRelatedInfoCapability: boolean)
{
	log.methodStart("validate extjs file text", 1, "", true);

	const parsedComponents = await parseExtJsFile(options);
	const diagnostics: Diagnostic[] = [];
	const textObj = TextDocument.create(options.fsPath, "javascript", 2, options.text);

	//
	// For each component found, perform the following validations:
	//
	//     1. xTypes
	//     1. Method variables
	//
	parsedComponents?.forEach(cmp =>
	{
		//
		// Validate all the widget references for this class
		//
		if (globalSettings.validateXTypes)
		{
			cmp.widgets.filter(w => w.type === "xtype" || w.type === "type").forEach((w) => {
				if (w.type !== "type" || !globalSettings.ignoreTypes.includes(w.name)) {
					validateXtype(w, cmp, diagRelatedInfoCapability, textObj, diagnostics);
				}
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
		// Validate micins array
		//
		validateRequiredClasses(cmp.mixins, cmp, diagRelatedInfoCapability, textObj, diagnostics);
		//
		// model property on stores
		//
		cmp.properties.filter(p => validateProperties.includes(p.name)).forEach((p) => {
			if (!globalSettings.ignoreTypes.includes(p.name)) {
				validateRequiredClass(p, cmp, true, diagRelatedInfoCapability, textObj, diagnostics);
			}
		});

		//
		// TODO - Validate method variables
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
	const locDiag = await validateExtJsSyntax(textObj, connection, diagRelatedInfoCapability, false);
	if (locDiag.length > 0) {
		diagnostics.push(...locDiag);
	}

	//
	// Send the diagnostics to the client, if any
	//
	connection.sendDiagnostics({ uri: textObj.uri, diagnostics });


	log.methodDone("validate extjs file text", 1, "", true);
}


function validateXtype(widget: IWidget, thisCmp: IComponent, diagRelatedInfoCapability: boolean, document: TextDocument, diagnostics: Diagnostic[])
{
	const widgetCls = extjs.getComponent(widget.name, thisCmp.project, components, widget.start, thisCmp)?.componentClass,
		  fsPath = URI.file(document.uri).fsPath,
		  eNotFoundCode = (ErrorCode as any)[`${widget.type}NotFound`],
		  eNoRequiresCode = (ErrorCode as any)[`${widget.type}NoRequires`],
		  range = toVscodeRange(widget.start, widget.end);
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
	if (!widgetCls && ignoreText !== `/** vscode-extjs-ignore-${eNotFoundCode} */`)
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
				message: `The referenced ${widget.type} "${widget.name}" was not found.`,
				source: "vscode-extjs",
				code: eNotFoundCode
			};

			if (diagRelatedInfoCapability) {
				addXTypeSuggestions(diagnostic, widget, thisCmp, document);
			}

			diagnostics.push(diagnostic);
		}
	}

	if (extjs.isNeedRequire(widgetCls, components) && ignoreText !== `/** vscode-extjs-ignore-${eNoRequiresCode} */`)
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
			let thisXType: string | undefined,
				refCount = 0;
			//
			// Push the requires classes that are included by each file of the requires listed in this file
			//
			const pushInheritedRequires = (req: IRequires) =>
			{
				req.value.forEach(r =>
				{
					const reqCmp = extjs.getComponent(r.name, thisCmp.project, components);
					if (reqCmp && reqCmp.requires?.value)
					{
						requires.push(...reqCmp.requires.value);
						refCount += reqCmp.requires.value.length;
						if (refCount < 150) {
							pushInheritedRequires(reqCmp.requires);
						}
					}
				});
			};
			//
			// Push the requires classes listed in this component file
			//
			if (thisCmp.requires?.value) {
				requires.push(...thisCmp.requires.value);
				pushInheritedRequires(thisCmp.requires);
			}
			//
			// Push the requires classes listed in the main Ext.application, these are loaded at app load time
			//
			const mainAppComponent = components.find(c => c.extend === "Ext.app.Application");
			if (mainAppComponent)
			{
				if (mainAppComponent.requires?.value) {
					requires.push(...mainAppComponent.requires.value);
					pushInheritedRequires(mainAppComponent.requires);
				}
				if (mainAppComponent.models?.value) {
					requires.push(...mainAppComponent.models.value);
				}
				if (mainAppComponent.stores?.value) {
					requires.push(...mainAppComponent.stores.value);
				}
			}
			//
			// Push the requires classes listed in classes extended.
			//
			let extCmpCls = thisCmp.extend;
			while (extCmpCls)
			{
				const extCmp = extjs.getComponent(extCmpCls, thisCmp.project, components);
				if (extCmp && extCmp.requires?.value)
				{
					requires.push(...extCmp.requires.value);
					refCount += extCmp.requires.value.length;
					if (refCount < 150) {
						pushInheritedRequires(extCmp.requires);
						extCmpCls = extCmp.extend;
					}
					else {
						extCmpCls = undefined;
					}
				}
				else {
					extCmpCls = undefined;
				}
			}
			//
			// Ignore if this is the defined xtype of the component itself
			//
			if (widgetCls === thisCmp.componentClass) {
				requiredXtypes.push(widget.name);
			}
			else if (requires.length > 0)
			{
				for (const require of requires)
				{
					if (require.name !== widgetCls) {
						const aliasNsReplaceRegex = /(?:[^\.]+\.)+/i;
						const requiredCmp = extjs.getComponent(require.name, thisCmp.project, components);
						if (requiredCmp) {
							if (widget.type === "type") {
								requiredXtypes.push(...(requiredCmp.types.map(x => x.name.replace(aliasNsReplaceRegex, "")) || []));
							}
							else {
								requiredXtypes.push(...(requiredCmp.xtypes.map(x => x.name.replace(aliasNsReplaceRegex, "")) || []));
							}
							requiredXtypes.push(...(requiredCmp.aliases.map(s => s.name.replace(aliasNsReplaceRegex, "")) || []));
						}
					}
					else {
						thisXType = widget.name;
					}
				}
			}

			if (!requiredXtypes.includes(widget.name) && widget.name !== thisXType)
			{
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Warning,
					range,
					message: `The referenced ${widget.type} "${widget.name}" does not have a corresponding requires directive.`,
					source: "vscode-extjs",
					code: eNoRequiresCode
				};
				diagnostics.push(diagnostic);
			}
		}
	}

}


function validateRequiredClass(property: IRequire | IProperty, cmp: IComponent, checkIgnore: boolean,  diagRelatedInfoCapability: boolean, document: TextDocument, diagnostics: Diagnostic[])
{
	if (property && (!checkIgnore || !isIgnoredGlobal(URI.file(document.uri).fsPath)))
	{
		const propertyName = extjs.isProperty(property) ? property.value?.value : property.name;
		if (extjs.getComponent(propertyName, cmp.project, components)) { // if we have a mapping, then no diagnostic
			return;
		}

		if (getIgnoreText(property, document) !== `/** vscode-extjs-ignore-${ErrorCode.classNotFound} */`)
		{
			const range = extjs.isProperty(property) && property.value ? toVscodeRange(property.value.start, property.value.end) :
																		 toVscodeRange(property.start, property.end);
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range,
				message: "No corresponding class definition found.",
				source: "vscode-extjs",
				code: ErrorCode.classNotFound
			};
			if (diagRelatedInfoCapability && propertyName) {
				addClassSuggestions(diagnostic, propertyName, document);
			}
			diagnostics.push(diagnostic);
		}
	}
}


function validateRequiredClasses(cmpRequires: IRequires | IUses | IMixins | undefined, cmp: IComponent, diagRelatedInfoCapability: boolean, document: TextDocument, diagnostics: Diagnostic[])
{
	if (cmpRequires && !isIgnoredGlobal(URI.file(document.uri).fsPath)) {
		const requires: IRequire[] = cmpRequires.value;
		for (const require of requires) {
			validateRequiredClass(require, cmp, false, diagRelatedInfoCapability, document, diagnostics);
		}
	}
}


function addSuggestion(a: string, text: string, suggestions: string[])
{
	//
	// Don''t expect the user to misspell by more than a character or two, so apply
	// a 2 character threshold on the length of the strings that we should compare
	//
	// Max 5 suggestions
	//
	if (a.length < text.length - 2 || a.length > text.length + 2 || suggestions.length >= 5) {
		return;
	}

	const componentPart1 = a.substring(0, a.length / 2),
		componentPart2 = a.substring(a.length / 2),
		textPart1 = text.substring(0, text.length / 2),
		textPart2 = text.substring(text.length / 2);

	if (a.indexOf(text) === 0) {
		suggestions.push(a);
	}
	else if (text.indexOf(a) === 0) {
		suggestions.push(a);
	}
	else if (text.match(new RegExp(`${componentPart1}[\\w]+`))) {
		suggestions.push(a);
	}
	else if (text.match(new RegExp(`[\\w]+${componentPart2}`))) {
		suggestions.push(a);
	}
	else if (a.match(new RegExp(`${textPart1}[\\w]+`))) {
		suggestions.push(a);
	}
	else if (a.match(new RegExp(`[\\w]+${textPart2}`))) {
		suggestions.push(a);
	}
}


function addClassSuggestions(diagnostic: Diagnostic, text: string, document: TextDocument)
{
	const suggestions: string[] = [];
	//
	// See if some suggestions can be made...
	//
	components.map(c => c.componentClass).forEach(cls => addSuggestion(cls, text, suggestions));

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


function addXTypeSuggestions(diagnostic: Diagnostic, widget: IWidget, thisCmp: IComponent, document: TextDocument)
{
	const suggestions: string[] = [];
	const _add = (aliases: IWidget[]) =>
	{
		aliases.map(a => a.name).forEach(a => addSuggestion(a, widget.name, suggestions));
	};

	//
	// See if some suggestions can be made...
	//
	components.forEach(component =>
	{
		if (suggestions.length < 5)
		{
			if (widget.type === "type") {
				_add(component.types);
			}
			_add(component.xtypes);
			_add(component.aliases);
		}
	});

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
