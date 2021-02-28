
import {
    CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, CompletionList,
    ExtensionContext, languages, Position, ProviderResult, TextDocument
} from "vscode";
import { widgetToComponentClassMapping } from "../languageManager";


class XtypeCompletionItemProvider implements CompletionItemProvider
{
    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList>
    {
        const completionItems: ProviderResult<CompletionItem[] | CompletionList> = [];
        // const simpleCompletion = new vscode.CompletionItem('Hello World!');
        // completionItems.push(simpleCompletion);

        Object.keys(widgetToComponentClassMapping).forEach(xtype =>
        {
            const xtypeCompletion = new CompletionItem(`xtype: ${xtype}`);
            xtypeCompletion.insertText = `xtype: "${xtype}",`;
            xtypeCompletion.command = {command: "vscode-extjs:ensureRequire", title: "ensureRequire"};
            completionItems.push(xtypeCompletion);
        });

        return completionItems;
    }

}


function registerXtypeCompletionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCompletionItemProvider("javascript", new XtypeCompletionItemProvider()));
}


export default registerXtypeCompletionProvider;
