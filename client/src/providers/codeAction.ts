
import {
    CancellationToken, CodeActionProvider, ExtensionContext, languages, ProviderResult,
    TextDocument, CodeAction, CodeActionContext, Command, Range, Selection, CodeActionKind
} from "vscode";
import { ErrorCode } from "../../../common";


class XtypeCodeActionProvider implements CodeActionProvider
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
                        for (const info of d.relatedInformation)
                        {
                            const matches = info.message.match(/Did you mean: ([A-Z0-9]+)/i);
                            if (matches)
                            {
                                const suggestions = matches[1].replace(/ /g, "").split(","),
                                    addSuggest = [];
                                for (const suggestion of suggestions)
                                {
                                    addSuggest.push({
                                        title: "Replace declared xtype with '" + suggestion + "'",
                                        isPreferred: true,
                                        kind: CodeActionKind.QuickFix,
                                        command: {
                                            title: "Replace declared xtype with '" + suggestion + "'",
                                            command: "vscode-extjs:replaceText",
                                            arguments: [ '"' + suggestion + '"', range ]
                                        }
                                    });
                                }
                                if (addSuggest.length > 0) {
                                    actions.push(...addSuggest);
                                }
                            }
                        }
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
                }
            }
        }

        return actions;
    }

}


function registerXtypeCodeActionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCodeActionsProvider("javascript", new XtypeCodeActionProvider()));
}


export default registerXtypeCodeActionProvider;
