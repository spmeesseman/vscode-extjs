
import { ExtensionContext } from "vscode";
import registerXtypeCompletionProvider from "./xtypeCompletion";
import registerXtypeDefinitionProvider from "./xtypeDefinion";
import registerXtypeHoverProvider from "./xtypeHover";
import registerPropertyHoverProvider from "./propertyHover";
import registerPropertyCompletionProvider from "./propertyCompletion";
import registerPropertyDefinitionProvider from "./propertyDefinion";


export type Register = (context: ExtensionContext) => void;


export function registerProviders(context: ExtensionContext)
{
    const registers: Register[] = [
        registerXtypeHoverProvider,
        registerXtypeDefinitionProvider,
        registerXtypeCompletionProvider,
        registerPropertyHoverProvider,
        registerPropertyCompletionProvider,
        registerPropertyDefinitionProvider
    ];
    registers.forEach(register => register(context));
}
