
import * as log from "../common/log";
import {
    CancellationToken, CodeActionProvider, ExtensionContext, languages, commands,
    TextDocument, CodeAction, CodeActionContext, Command, Range, Selection, CodeActionKind, DiagnosticRelatedInformation
} from "vscode";
import { ErrorCode } from "../../../common";
import { quoteChar } from "../common/clientUtils";


class ExtjsCodeActionProvider implements CodeActionProvider
{
    async provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken)
    {
        const actions: CodeAction[] = [];

        //
        // ** IMPORTANT **
        // It's possible the indexer initiated a re-indexing since editing the document is
        // what triggers thecompletion item request, so wait for it to finish b4 proceeding
        //
        await commands.executeCommand("vscode-extjs:waitReady", "   ");
        //
        // Indexer finished, proceed...
        //

        if (!context.only || context.only?.value === CodeActionKind.QuickFix.value)
        {
            for (const d of context.diagnostics)
            {
                if (d.source === "vscode-extjs")
                {
                    if (!d.range.intersection(range) && !range.intersection(d.range)) {
                        continue;
                    }

                    actions.push(...[{
                        title: "Ignore errors of this type (this line only)",
                        isPreferred: true,
                        kind: CodeActionKind.QuickFix,
                        command: {
                            title: "Ignore errors of this type (this line only)",
                            command: "vscode-extjs:ignoreError",
                            arguments: [ d.code, document, range ]
                        }
                    },
                    {
                        title: "Ignore errors of this type (file)",
                        isPreferred: true,
                        kind: CodeActionKind.QuickFix,
                        command: {
                            title: "Ignore errors of this type (file)",
                            command: "vscode-extjs:ignoreError",
                            arguments: [ d.code, document ]
                        }
                    },
                    {
                        title: "Ignore errors of this type (global)",
                        isPreferred: true,
                        kind: CodeActionKind.QuickFix,
                        command: {
                            title: "Ignore errors of this type (global)",
                            command: "vscode-extjs:ignoreError",
                            arguments: [ d.code ]
                        }
                    }]);

                    if (d.code === ErrorCode.xtypeNotFound && d.relatedInformation)
                    {
                        addSuggestedActions(d.relatedInformation, "xtype", range, actions);
                    }
                    else if (d.code === ErrorCode.typeNotFound && d.relatedInformation)
                    {
                        addSuggestedActions(d.relatedInformation, "type", range, actions);
                    }
                    else if (d.code === ErrorCode.typeNoRequires || d.code === ErrorCode.xtypeNoRequires)
                    {
                        const propertyName = d.code === ErrorCode.typeNoRequires ? "type" : "xtype";
                        actions.push(...[
                        {
                            title: `Fix the 'requires' array for this declared ${propertyName}`,
                            isPreferred: true,
                            kind: CodeActionKind.QuickFix,
                            command: {
                                title: `Fix the 'requires' array for this declared ${propertyName}`,
                                command: "vscode-extjs:ensureRequire",
                                arguments: [ document.getText(range).replace(/["']/g, "") ]
                            }
                        },
                        {
                            title: `Fix the 'requires' array for all declared ${propertyName}s`,
                            isPreferred: true,
                            kind: CodeActionKind.QuickFix,
                            command: {
                                title: `Fix the 'requires' array for all declared ${propertyName}s`,
                                command: "vscode-extjs:ensureRequire"
                            }
                        }]);
                    }
                    else if (d.code === ErrorCode.classNotFound && d.relatedInformation)
                    {
                        addSuggestedActions(d.relatedInformation, "class", range, actions);
                    }
                }
            }
        }

        return actions;
    }

}


function addSuggestedActions(relatedInformation: DiagnosticRelatedInformation[], label: string, range: Range | Selection, actions: CodeAction[])
{
    for (const info of relatedInformation)
    {
        const matches = info.message.match(/Did you mean: ([A-Z0-9, .-_]+)/i);
        if (matches)
        {
            const suggestions = matches[1].replace(/ /g, "").split(","),
                quote = quoteChar(),
                addSuggest = [];


            for (const suggestion of suggestions)
            {
                addSuggest.push({
                    title: `Replace declared ${label} with ${quote}${suggestion}${quote}`,
                    isPreferred: true,
                    kind: CodeActionKind.QuickFix,
                    command: {
                        title: `Replace declared ${label} with ${quote}${suggestion}${quote}`,
                        command: "vscode-extjs:replaceText",
                        arguments: [ `${quote}${suggestion}${quote}`, range ]
                    }
                });
            }
            actions.push(...addSuggest);
        }
    }
}


function registerXtypeCodeActionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCodeActionsProvider("javascript", new ExtjsCodeActionProvider()));
}


export default registerXtypeCodeActionProvider;
