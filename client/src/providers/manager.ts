
import { ExtensionContext } from "vscode";
import registerCodeActionProvider from "./codeAction";
import registerHoverProvider from "./hover";
import registerCompletionProvider from "./completion";
import registerDefinitionProvider from "./definition";
import registerMethodSignatureProvider from "./methodSignature";
import registerTypeDefinitionProvider from "./typeDefinition";


export type Register = (context: ExtensionContext) => void;


export function registerProviders(context: ExtensionContext)
{
    const registers: Register[] = [
        registerCodeActionProvider,
        registerHoverProvider,
        registerCompletionProvider,
        registerDefinitionProvider,
        registerMethodSignatureProvider,
        registerTypeDefinitionProvider
    ];

    registers.forEach(register => register(context));
}
