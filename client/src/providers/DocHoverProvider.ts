
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, Range, TextDocument
} from "vscode";
import { getExtjsComponentClass } from "../common/ExtjsLanguageManager";


class DocHoverProvider implements HoverProvider
{
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover>
    {
        const range = document.getWordRangeAtPosition(position);
        if (range === undefined) {
            return;
        }
        const line = position.line,
              nextLine = document.lineAt(line + 1),
			  property = document.getText(range),
			  text = document.getText(new Range(new Position(line, 0), nextLine.range.start));
        if (text.match(new RegExp(`${property}\\([\\W\\w]*\\)\\s*;\\s*$`)))
        {
            // const cmpClass = getExtjsComponentClass(property);
            // if (cmpClass) {
                return new Hover(`* **gonna get the docs**: ${property} \n* **docs**: ${property}`);
            // }
        }

        return undefined;
    }

}


export default function registerDocHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new DocHoverProvider()));
}