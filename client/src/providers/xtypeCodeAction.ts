
import {
    CancellationToken, CodeActionProvider, ExtensionContext, languages, ProviderResult,
    TextDocument, CodeAction, CodeActionContext, Command, Range, Selection, CodeActionKind
} from "vscode";
import { ErrorCode } from "../../../common/src";


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
                        title: "Fix the 'requires' array for invalid xtypes",
                        command: "vscode-extjs:ensureRequire"
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
