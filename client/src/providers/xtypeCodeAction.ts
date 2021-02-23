
import {
    CancellationToken, CompletionContext, CompletionItem, CodeActionProvider, CompletionList,
    ExtensionContext, languages, Position, ProviderResult, TextDocument, CodeAction, CodeActionContext, Command, Range, Selection
} from "vscode";


class XtypeCodeActionProvider implements CodeActionProvider
{
    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]>
    {
        return [];
    }

}


function registerXtypeCodeActionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCodeActionsProvider("javascript", new XtypeCodeActionProvider()));
}


export default registerXtypeCodeActionProvider;
