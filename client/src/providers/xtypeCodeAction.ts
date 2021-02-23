
import {
    CancellationToken, CodeActionProvider, ExtensionContext, languages, ProviderResult,
    TextDocument, CodeAction, CodeActionContext, Command, Range, Selection, CodeActionKind
} from "vscode";


class XtypeCodeActionProvider implements CodeActionProvider
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
            if (d.message.match(/^The referenced xtype "\w+" was not found.$/))
            {
                actions.push(...[
                {
                    title: "Fix the 'requires' array for this invalid xtype",
                    isPreferred: true,
                    kind: CodeActionKind.QuickFix,
                    command: {
                        title: "Fix the 'requires' array for this invalid xtype",
                        command: "vscode-extjs:ensure-require",
                        arguments: [ document.getText(range).replace(/["']/g, "") ]
                    }
                },
                {
                    title: "Fix the 'requires' array for all invalid xtypes",
                    isPreferred: true,
                    kind: CodeActionKind.QuickFix,
                    command: {
                        title: "Fix the 'requires' array for invalid xtypes",
                        command: "vscode-extjs:ensure-require"
                    }
                }]);
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
