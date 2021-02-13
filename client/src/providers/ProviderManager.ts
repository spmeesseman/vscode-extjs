
import { ExtensionContext } from "vscode";
import registerXtypeCompletionItemProvider from "./XtypeCompletionItemProvider";
import registerXtypeDefinitionProvider from "./XtypeDefinionProvider";
import registerXtypeHoverProvider from "./XtypeHoverProvider";


export type Register = (context: ExtensionContext) => void;


export function registerProviders(context: ExtensionContext)
{
    const registers: Register[] = [
        registerXtypeHoverProvider,
        registerXtypeDefinitionProvider,
        registerXtypeCompletionItemProvider,
    ];
    registers.forEach(register => register(context));
}
