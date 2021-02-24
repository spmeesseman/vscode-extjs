
import {
    CancellationToken, CodeActionProvider, ExtensionContext, languages, ProviderResult,
    TextDocument, CodeAction, CodeActionContext, Command, Range, Selection, CodeActionKind
} from "vscode";


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
                actions.push(...[
                {
                    title: "Convert to camel case",
                    isPreferred: true,
                    kind: CodeActionKind.QuickFix,
                    command: {
                        title: "Convert to camel case",
                        command: "editor.action.transformToLowercase"
                    }
                },
                {
                    title: "Convert to lower case",
                    isPreferred: true,
                    kind: CodeActionKind.QuickFix,
                    command: {
                        title: "Convert to lower case",
                        command: "editor.action.transformToLowercase"
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
