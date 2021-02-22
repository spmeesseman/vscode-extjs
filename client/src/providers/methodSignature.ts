
import {
    ExtensionContext, languages, Position, CancellationToken, ProviderResult, ParameterInformation,
    TextDocument, SignatureHelpProvider, SignatureHelp, SignatureHelpContext, SignatureInformation
} from "vscode";
import { IMethod } from "../../../common";
import { componentClassToComponentsMapping } from "../languageManager";
import * as log from "../common/log";


class MethodSignatureProvider implements SignatureHelpProvider
{
	provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): ProviderResult<SignatureHelp>
	{
        const lineText = document.lineAt(position).text.substr(0, position.character),
			  sigHelp = new SignatureHelp();

        //
        // Check for "(" since VSCode 24/7 Intellisense will trigger every character no matter what
        // the trigger char(s) is for this provider.  24/7 Intellisense can be turned off in settings.json:
        //
        //    "editor.quickSuggestions": false
        //
        if (!lineText || !lineText.includes("(") || lineText.endsWith(")")) {
            return undefined;
        }

        log.logMethodStart("provide method signature", 2, "", true, [["line text", lineText]]);

		sigHelp.signatures = [ this.getSignatureInfo(lineText) ];

		//
		// Current params index
		//
		let commaIdx = lineText.indexOf(",");
		sigHelp.activeParameter = 0;
		while (commaIdx !== -1) {
			++sigHelp.activeParameter;
			commaIdx = lineText.indexOf(",", commaIdx + 1);
		}

        log.logMethodDone("provide method signature", 2, "", true);

        return sigHelp;
    }


    getSignatureInfo(lineText: string): SignatureInformation
    {
		let signature = "",
			method: IMethod;
        const params: ParameterInformation[] = [],
			  matches = lineText.match(/([\w]+\.)/g);

        if (matches)
        {
            let cls = "";
            for (const m of matches)
            {
                cls += m;
            }
            cls = cls.substring(0, cls.length - 1); // remove trailing .
            const cmp = componentClassToComponentsMapping[cls];

            if (cmp)
            {
				const methodName = lineText.substring(lineText.lastIndexOf(".") + 1, lineText.indexOf("("));
                for (const m of cmp.methods)
                {
                    if (m.name === methodName && m.params)
                    {
						method = m;
						for (const p of m.params)
						{
                        	params.push(new ParameterInformation(p.name, p.doc));
						}
						break;
                    }
                }
            }
        }

		params.forEach((p) => {
			if (signature) {
				signature += ", ";
			}
			signature += p.label;
		});

		const sigInfo = new SignatureInformation(signature);
		sigInfo.parameters = params;

        return sigInfo;
    }
}


function registerMethodSignatureProvider(context: ExtensionContext)
{
    context.subscriptions.push(
        languages.registerSignatureHelpProvider("javascript", new MethodSignatureProvider())
    );
}


export default registerMethodSignatureProvider;
