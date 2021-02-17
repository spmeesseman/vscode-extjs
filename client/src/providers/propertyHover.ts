
import {
    CancellationToken, ExtensionContext, Hover, HoverProvider, languages, Position,
    ProviderResult, Range, TextDocument, MarkdownString
} from "vscode";
import { getComponent, getConfig, getMethod, getProperty } from "../languageManager";
import * as util from "../common/utils";

enum MarkdownChars
{
    NewLine = "  \n",
    TypeWrapBegin = "[",
    TypeWrapEnd = "]",
    LongDash = "&#8212;",
    Black = "\\u001b[30m",
    Red = "\\u001b[31",
    Green = "\\u001b[32m",
    Yellow = "\\u001b[33m",
    Blue = "\\u001b[34m",
    Magenta = "\\u001b[35",
    Cyan = "\\u001b[36m",
    White = "\\u001b[37m"
}

enum MarkdownStringMode
{
    Code,
    Config,
    Deprecated,
    Method,
    Normal,
    Private,
    Property,
    Param,
    Returns,
    Since,
    Singleton
}

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
			  lineText = document.getText(new Range(new Position(line, 0), nextLine.range.start));

        //
        // Methods
        //
        if (lineText.match(new RegExp(`${property}\\([\\W\\w]*\\)\\s*;\\s*$`)))
        {
            const cmpClass = getComponent(property, lineText);
            if (cmpClass) {
                util.logValue("Provide function hover info", property, 1);
                if (property.startsWith("get") || property.startsWith("set") && property[3] >= "A" && property[3] <= "Z")
                {
                    const gsProperty = property.substring(3).replace(/(?:^\w|[A-Za-z]|\b\w)/g, (letter, index) => {
                        return index !== 0 ? letter : letter.toLowerCase();
                    });
                    let config = getConfig(cmpClass, gsProperty);
                    if (!config) {
                        config = getConfig(cmpClass, property);
                    }
                    if (config && config.doc) {
                        return new Hover(commentToMarkdown(gsProperty, config.doc));
                    }
                }
                else
                {
                    const method = getMethod(cmpClass, property);
                    if (method && method.doc) {
                        return new Hover(commentToMarkdown(property, method.doc));
                    }
                }
            }
        }

        //
        // Properties / configs
        //
        else if (lineText.match(new RegExp(`.${property}\\s*[;\\)]+\\s*$`)))
        {
            const cmpClass = getComponent(property, lineText);
            if (cmpClass) {
                const config = getConfig(cmpClass, property);
                if (config && config.doc) {
                    util.logValue("Provide config hover info", property, 1);
                    return new Hover(commentToMarkdown(property, config.doc));
                }
                else {
                    const prop = getProperty(cmpClass, property);
                    if (prop && prop.doc) {
                        util.logValue("Provide property hover info", property, 1);
                        return new Hover(commentToMarkdown(property, prop.doc));
                    }
                }
            }
        }

        return undefined;
    }

}


function commentToMarkdown(property: string, comment: string): MarkdownString
{
    const markdown = new MarkdownString();

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

    const docLines = commentFmt.split(/\r{0,1}\n{1}\s*\*( |$)/);
    let mode: MarkdownStringMode | undefined,
        indented = "",
        previousMode: MarkdownStringMode | undefined,
        trailers: string[] = [];

    docLines.forEach((line) =>
    {
        if (!line.trim()) {
            return; // continue forEach()
        }

        if (markdown.value.length > 0 && mode !== MarkdownStringMode.Code) {
            markdown.appendMarkdown(MarkdownChars.NewLine);
        }

        line = line
        //
        // Remove line breaks, we format later depending on comment parts, done w/ Clojure
        // standard line breaks
        //
        .replace(/\n/, "")
        //
        // Remove leading "* " for each line in the comment
        //
        .replace(/\* /, "")
        .replace(/\s*\*$/, ""); // <- Blank lines
        //
        // Italicize @ tags
        //
        // .replace(/@[a-z]+ /, function(match) {
        //     return "_" + match.trim() + "_";
        // });
        // .trim();

        util.logValue("   process line", line, 4);

        if (!line.trim()) {
            return; // continue forEach()
        }

        mode = getMode(line);

        if (indented && mode !== MarkdownStringMode.Code)
        {
            markdown.appendCodeblock(indented.trim());
            indented = "";
        }

        //
        // If 'mode' defined, and strings exist in the 'trailers' array, then then we are done
        // processing previous tag block.  e.g.:
        //
        //     @param {Boolean} [show=true]  Show the button to open a help desk ticket
        //     User can select whetheror not to submit a ticket.
        //     [ TRAILERS GO HERE ]
        //     @param {Boolean} [ask=true]  Prompt for input   ( <--- processing this line)
        //
        if (mode !== undefined && mode !== MarkdownStringMode.Code && trailers.length)
        {
            trailers.forEach((t) => {
                markdown.appendMarkdown(t);
            });
            trailers = [];
        }

        mode = mode !== undefined ? mode : previousMode;

        previousMode = mode;

        if (mode === MarkdownStringMode.Config || mode === MarkdownStringMode.Property || mode === MarkdownStringMode.Method)
        {
            handleObjectLine(line, property, markdown);
        }
        else if (mode === MarkdownStringMode.Param)
        {
            handleParamLine(line, trailers, markdown);
        }
        else if (mode === MarkdownStringMode.Code)
        {
            util.logValue("      indented line", line, 4);
            indented += MarkdownChars.NewLine + line.trim();
        }
        else if (mode === MarkdownStringMode.Returns)
        {
            handleReturnsLine(line, markdown);
        }
        else
        {
            handleTextLine(line, markdown);
        }
    });

    return markdown;
}


function getMode(line: string): MarkdownStringMode | undefined
{
    let mode;
    if (line.startsWith("@"))
    {
        const tag = line.substring(0, line.indexOf(" "));
        switch (tag)
        {
            case "@cfg":
            case "@config":
                mode = MarkdownStringMode.Config;
                break;
            case "@property":
                mode = MarkdownStringMode.Property;
                break;
            case "@param":
                mode = MarkdownStringMode.Param;
                break;
            case "@returns":
            case "@return":
                mode = MarkdownStringMode.Returns;
                break;
            case "@method":
                mode = MarkdownStringMode.Method;
                break;
            case "@since":
                mode = MarkdownStringMode.Since;
                break;
            case "@deprecated":
                mode = MarkdownStringMode.Deprecated;
                break;
            case "@private":
                mode = MarkdownStringMode.Private;
                break;
            case "@singleton":
                mode = MarkdownStringMode.Singleton;
                break;
            default:
                break;
        }
        util.logValue("      found @ tag", tag, 4);
        util.logValue("      set mode", mode?.toString(), 4);
    }
    else if (line.length > 3 && (line.substring(0, 3) === "   " || line[0] === "\t"))
    {
        mode = MarkdownStringMode.Code;
    }
    return mode;
}


function handleObjectLine(line: string, property: string, markdown: MarkdownString)
{
    let cfgLine = "";
    if (line.startsWith("@")) {
        const lineParts = line.split(property);
        cfgLine = lineParts[0] + "_**" + property + "**_ " + lineParts[1];
    }
    else {
        cfgLine = line.trim();
    }
    util.logValue("      insert object line", cfgLine, 4);
    markdown.appendMarkdown(cfgLine);
}


function handleParamLine(line: string, trailers: string[], markdown: MarkdownString)
{
    if (!line.startsWith("@"))
    {
        util.logValue("      insert param text line", line, 4);
        markdown.appendMarkdown(line);
        return;
    }

    let lineProperty = "", lineType = "",
        lineValue = "", lineTrail = "";
    const lineParts = line.split(" ");
    //
    // Examples:
    //
    //     @param {Object} opt Delivery options.
    //     @param {String} msg The specific error message.
    //     Some more descriptive text about the above property.
    //     @param {Boolean} [show=true]  Show the button to open a help desk ticket
    //     Some more descriptive text about the above property.
    //
    // Trailing line text i.e. 'Some more descriptive text about the above property' gets
    // stored into 'lineTrail'.  THis is placed "before" the default value extracted from a
    // first line i.e. [show=true].
    //
    if (lineParts.length > 1)
    {   //
        // Check for no type i.e. @param propName the description here
        //
        if (!lineParts[1].match(/\{[A-Z]+\}/i))
        {
            lineType = "";
            lineProperty = lineParts[1];
            if (lineParts.length > 2)
            {
                lineParts.shift();
                lineParts.shift();
                lineTrail = lineParts.join(" ");
            }
            else {
                lineParts.shift();
                lineTrail = "";
            }
        }
        //
        // Has type i.e. @param {String} propName the description here
        //
        else if (lineParts.length > 2)
        {
            lineType = lineParts[1];
            lineProperty = lineParts[2];
            if (lineParts.length > 3)
            {
                lineParts.shift();
                lineParts.shift();
                lineParts.shift();
                lineTrail = lineParts.join(" ");
            }
        }
    }

    //
    // If no property name was found, then there's nothing to add to the markdown, exit
    //
    if (!lineProperty) {
        return;
    }

    util.logValue("          name", lineProperty, 4);
    util.logValue("          type", lineType, 4);

    if (lineType)
    {
        lineType = lineType.replace(/[\{\}]/g, "");
    }

    //
    // Check for a default value, for example:
    //
    //     @param {Boolean} [debug=true] Set to `true` to...
    //
    // If a default value is found, set 'lineValue' and this is added to the 'trailers'
    // array to be placed at the end of the params documentation body
    //
    if (lineProperty.match(/\[[A-Z0-9]+=[A-Z0-9"'`]+\]/i))
    {
        lineProperty = lineProperty.replace(/[\[\]]/g, "");
        const paramParts = lineProperty.split("=");
        lineProperty = paramParts[0];
        lineValue = paramParts[1];
    }

    let paramLine = "*@param* _**" + lineProperty + "**_ *" + MarkdownChars.TypeWrapBegin +
                    lineType + MarkdownChars.TypeWrapEnd + "*";
    if (lineTrail) {
        paramLine += " " + MarkdownChars.LongDash + lineTrail;
    }
    util.logValue("      param line", paramLine, 4);
    if (!markdown.value.endsWith(MarkdownChars.NewLine)) {
        markdown.appendMarkdown(MarkdownChars.NewLine);
    }
    markdown.appendMarkdown(paramLine);

    if (lineValue)
    {
        trailers.push(MarkdownChars.NewLine + "- *Defaults to:* `" +
                      lineValue.replace(/`/g, "") + "`" +  MarkdownChars.NewLine +  MarkdownChars.NewLine);
    }
    else {
        markdown.appendMarkdown(MarkdownChars.NewLine);
    }
}


function handleReturnsLine(line: string, markdown: MarkdownString)
{
    const rtnLineParts = line.trim().split(" ");
    let rtnLine = "*" + rtnLineParts[0] + "* ";
    rtnLineParts.shift();
    rtnLine += rtnLineParts.join(" ");
    rtnLine = rtnLine.replace(/\*@return[s]{0,1}\* \{[A-Za-z]+\}/, (matched) => {
         return matched.replace(/\{[A-Za-z]+\}/, (matched2) => {
             return "*" + matched2.replace("{", MarkdownChars.TypeWrapBegin)
                                  .replace("}", MarkdownChars.TypeWrapEnd) + "*";
         }); // "<span style=\"color:blue\">" + matched + "</style>";
    });
    util.logValue("      insert returns line", rtnLine, 4);
    markdown.appendMarkdown(MarkdownChars.NewLine + rtnLine);
}


function handleTextLine(line: string, markdown: MarkdownString)
{
    let textLine = line.trim();
    util.logValue("      insert text line", textLine, 4);
    if (textLine.match(/@[\w]+ /))
    {
        const lineParts = line.trim().split(" ");
        textLine = "*" + textLine + "* ";
        if (lineParts.length > 1) {
            lineParts.shift();
            textLine += lineParts.join(" ");
        }
    }
    markdown.appendMarkdown(textLine);
}


export default function registerPropertyHoverProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerHoverProvider("javascript", new DocHoverProvider()));
}
