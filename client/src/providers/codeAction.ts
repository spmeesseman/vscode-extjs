
import * as log from "../common/log";
import {
    CancellationToken, CodeActionProvider, ExtensionContext, languages, ProviderResult,
    TextDocument, CodeAction, CodeActionContext, Command, Range, Selection, CodeActionKind, DiagnosticRelatedInformation
} from "vscode";
import { ErrorCode } from "../../../common";
import { quoteChar } from "../common/clientUtils";


class ExtjsCodeActionProvider implements CodeActionProvider
{
    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]>
    {
        const actions: CodeAction[] = [];

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
                    else if (d.code === ErrorCode.xtypeNoRequires)
                    {
                        actions.push(...[
                        {
                            title: "Fix the 'requires' array for this declared xtype",
                            isPreferred: true,
                            kind: CodeActionKind.QuickFix,
                            command: {
                                title: "Fix the 'requires' array for this declared xtype",
                                command: "vscode-extjs:ensureRequire",
                                arguments: [ document.getText(range).replace(/["']/g, "") ]
                            }
                        },
                        {
                            title: "Fix the 'requires' array for all declared xtypes",
                            isPreferred: true,
                            kind: CodeActionKind.QuickFix,
                            command: {
                                title: "Fix the 'requires' array for all declared xtypes",
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
