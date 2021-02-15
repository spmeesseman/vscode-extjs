
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, Range, TextDocument, MarkdownString
} from "vscode";
import { getExtjsComponentByConfig, getExtjsConfigByComponent } from "../common/ExtjsLanguageManager";
import * as util from "../common/Utils";

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
            const cmpClass = "VSCodeExtJS"; // getExtjsComponentByConfig(property);
            if (cmpClass) {
                util.log("Provide function hover info");
                // const config = getExtjsConfigByComponent(cmpClass, property);
                // if (config) {
                    return new Hover(`* **gonna get the docs**: ${property} \n* **docs**: ${property}`);
                // }
            }
        }

        if (text.match(new RegExp(`.${property}\\s*[;\\)]+\\s*$`)))
        {
            const cmpClass = "VSCodeExtJS"; // getExtjsComponentByConfig(property);
            if (cmpClass) {
                const config = getExtjsConfigByComponent(cmpClass, property);
                if (config && config.doc) {
                    util.log("Provide property/config hover info");
                    return new Hover(commentToMarkdown(property, config.doc));
                }
            }
        }

        return undefined;
    }

}


enum MarkdownStringMode
{
    Config,
    Method,
    Normal,
    Property,
    Param
}


function commentToMarkdown(property: string, comment: string): MarkdownString
{
    const markdown = new MarkdownString();
    const newLine = "  \n";
    const longDash = "--";
    let mode: MarkdownStringMode = MarkdownStringMode.Normal;

    //
    // JSDoc comments in the following form:
    //
    //     /**
    //     * @property propName
    //     * The property description
    //     * @returns {Boolean}
    //     */
    //
    //     /**
    //     * @method methodName
    //     * The method description
    //     * @property prop1 Property 1 description
    //     * @property prop2 Property 2 description
    //     * @returns {Boolean}
    //     */
    //
    // VSCode Hover API takes Clojure based markdown text.  See:
    //
    //     https://clojure.org/community/editing
    //

    util.log("   build markdown string from comment", 1);
    util.logValue("      ", comment, 3);

    const commentFmt = comment?.trim()
        //
        // Clean up beginning of string /**\n...
        //
        .replace(/^[\* \t\n\r]+/, "");
        //
        // Format line breaks to Clojure standard
        //
        // .replace(/\n/, newLine)
        // //
        // // Remove leading "* " for each line in the comment
        // //
        // .replace(/\* /, "")
        // //
        // // Bold @ tags
        // //
        // .replace(/@[a-z]+ /, function(match) {
        //     return "_**" + match.trim() + "**_ ";
        // })
        // .trim();

    const docLines = commentFmt.split("* ");
    docLines.forEach((line) =>
    {
        util.log("   process unformatted line:", 4);
        util.log("      " + line, 4);

        line = line
        //
        // Format line breaks to Clojure standard
        //
        .replace(/\n/, newLine)
        //
        // Remove leading "* " for each line in the comment
        //
        .replace(/\* /, "")
        //
        // Bold @ tags
        //
        // .replace(/@[a-z]+ /, function(match) {
        //     return "_**" + match.trim() + "**_ ";
        // })
        .trim();

        util.log("   formatted line:", 4);
        util.log("      " + line, 4);

        if (mode === MarkdownStringMode.Normal && line.startsWith("@"))
        {

            const lineParts = line.split(property);
            const partOne = lineParts[0].trim();
            markdown.appendMarkdown(lineParts[0] + "_**" + property + "**_ " + lineParts[1]);

            util.logValue("      found @ tag", partOne, 4);

            switch (partOne)
            {
                case "@cfg":
                    mode = MarkdownStringMode.Config;
                    break;
                case "@property":
                    mode = MarkdownStringMode.Property;
                    break;
                default:
                    break;
            }
        }
        else if (mode === MarkdownStringMode.Config)
        {
            const cfgLine = newLine + " " + line.trim();
            util.logValue("      config line", cfgLine.trim(), 4);
            markdown.appendMarkdown(cfgLine);
            mode = MarkdownStringMode.Normal;
        }
        else if (mode === MarkdownStringMode.Property)
        {
            const propLine = newLine + " " + line.trim();
            util.logValue("      property line", propLine.trim(), 4);
            markdown.appendMarkdown(propLine);
            mode = MarkdownStringMode.Normal;
        }
        else if (mode === MarkdownStringMode.Param)
        {
            const propLine = longDash + " " + line.trim();
            util.logValue("      param line", propLine.trim(), 4);
            markdown.appendMarkdown(propLine);
            mode = MarkdownStringMode.Normal;
        }
        else if (mode === MarkdownStringMode.Method)
        {
            const methodLine = longDash + " " + line.trim();
            util.logValue("      method line", methodLine.trim(), 4);
            markdown.appendMarkdown(methodLine);
            mode = MarkdownStringMode.Normal;
        }
        else
        {
            const textLine = line.trim();
            util.logValue("      text line", textLine, 4);
            markdown.appendText(newLine + textLine);
            mode = MarkdownStringMode.Normal;
        }
    });

    return markdown;
}


export default function registerDocHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new DocHoverProvider()));
}
