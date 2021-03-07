
import {
    CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, CompletionList,
    ExtensionContext, languages, Position, ProviderResult, TextDocument
} from "vscode";
import { extjsLangMgr } from "../extension";
import { isPositionInObject, getMethodByPosition } from "../common/clientUtils";


class XtypeCompletionItemProvider implements CompletionItemProvider
{
    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList>
    {
        const completionItems: ProviderResult<CompletionItem[] | CompletionList> = [],
              xtypes = extjsLangMgr.getXtypeNames(),
              cmp = extjsLangMgr.getComponentByFile(document.uri.fsPath);

        if (cmp && isPositionInObject(position, cmp) && getMethodByPosition(position, cmp))
        {
            // const simpleCompletion = new vscode.CompletionItem('Hello World!');
            // completionItems.push(simpleCompletion);

            for (const xtype of xtypes)
            {
                const xtypeCompletion = new CompletionItem(`xtype: ${xtype}`);
                xtypeCompletion.insertText = `xtype: "${xtype}",`;
                xtypeCompletion.command = {command: "vscode-extjs:ensureRequire", title: "ensureRequire"};
                completionItems.push(xtypeCompletion);
            }
        }

        return completionItems;
    }

}


function registerXtypeCompletionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCompletionItemProvider("javascript", new XtypeCompletionItemProvider(), "x"));
}


export default registerXtypeCompletionProvider;
