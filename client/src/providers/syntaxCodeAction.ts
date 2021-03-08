
import {
    CancellationToken, CodeActionProvider, ExtensionContext, languages, ProviderResult,
    TextDocument, CodeAction, CodeActionContext, Command, Range, Selection, CodeActionKind
} from "vscode";
import { utils, ErrorCode } from "../../../common";


class SyntaxCodeActionProvider implements CodeActionProvider
{
    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]>
    {
        const actions: CodeAction[] = [];

        if (!context.only || context.only.value === CodeActionKind.QuickFix.value)
        {
            for (const d of context.diagnostics)
            {
                if (d.source === "vscode-extjs")
                {
                    if (d.message.match(/^\w+ is all uppercase.$/))
                    {
                        const text = document.getText(range);
                        actions.push(...[
                        {
                            title: "Ignore errors of this type (file)",
                            isPreferred: true,
                            kind: CodeActionKind.QuickFix,
                            command: {
                                title: "Ignore errors of this type (file)",
                                command: "vscode-extjs:ignoreError",
                                arguments: [ ErrorCode.syntaxAllCaps, document.uri.fsPath ]
                            }
                        },
                        {
                            title: "Ignore errors of this type (global)",
                            isPreferred: true,
                            kind: CodeActionKind.QuickFix,
                            command: {
                                title: "Ignore errors of this type (global)",
                                command: "vscode-extjs:ignoreError",
                                arguments: [ ErrorCode.syntaxAllCaps ]
                            }
                        },
                        {
                            title: "Convert to camel case",
                            isPreferred: true,
                            kind: CodeActionKind.QuickFix,
                            command: {
                                title: "Convert to camel case",
                                command: "vscode-extjs:replaceText",
                                arguments: [ utils.toCamelCase(text, 1), range ]
                            }
                        },
                        {
                            title: "Convert to lower case",
                            isPreferred: true,
                            kind: CodeActionKind.QuickFix,
                            command: {
                                title: "Convert to lower case",
                                command: "vscode-extjs:replaceText",
                                arguments: [ text.toLowerCase(), range ]
                            }
                        }]);
                    }
                }
            }
        }

        return actions;
    }

}


function registerSyntaxCodeActionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCodeActionsProvider("javascript", new SyntaxCodeActionProvider()));
}


export default registerSyntaxCodeActionProvider;
