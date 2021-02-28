
import {
    CancellationToken, CodeActionProvider, ExtensionContext, languages, ProviderResult,
    TextDocument, CodeAction, CodeActionContext, Command, Range, Selection, CodeActionKind
} from "vscode";
import { utils } from "../../../common/src";


class SyntaxCodeActionProvider implements CodeActionProvider
{
    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]>
    {
        const actions: CodeAction[] = [];

        if (context.only?.value !== CodeActionKind.QuickFix.value) {
            return actions;
        }

        for (const d of context.diagnostics)
        {
            if (d.source !== "vscode-extjs") {
                continue;
            }
            if (d.message.match(/^\w+ is all uppercase.$/))
            {
                const text = document.getText(range);
                actions.push(...[
                {
                    title: "Ignore errors of this type",
                    isPreferred: true,
                    kind: CodeActionKind.QuickFix,
                    command: {
                        title: "Ignore errors of this type",
                        command: "vscode-extjs:ignoreError",
                        arguments: [ utils.toCamelCase(text, 1), range ]
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
                        title: "Convert to camel case",
                        command: "vscode-extjs:replaceText",
                        arguments: [ text.toLowerCase(), range ]
                    }
                }]);
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
