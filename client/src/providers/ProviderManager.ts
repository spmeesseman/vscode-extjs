
import { ExtensionContext } from "vscode";
import registerXtypeCompletionItemProvider from "./XtypeCompletionItemProvider";
import registerXtypeDefinitionProvider from "./XtypeDefinionProvider";
import registerXtypeHoverProvider from "./XtypeHoverProvider";
import registerDocHoverProvider from "./DocHoverProvider";


export type Register = (context: ExtensionContext) => void;


export function registerProviders(context: ExtensionContext)
{
    const registers: Register[] = [
        registerXtypeHoverProvider,
        registerXtypeDefinitionProvider,
        registerXtypeCompletionItemProvider,
        registerDocHoverProvider
    ];
    registers.forEach(register => register(context));
}
