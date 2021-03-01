
import { MarkdownString } from "vscode";
import * as log from "../common/log";


enum MarkdownChars
{
    NewLine = "  \n",
    TypeWrapBegin = "[",
    TypeWrapEnd = "]",
    Bold = "**",
    Italic = "*",
    BoldItalicStart = "_**",
    BoldItalicEnd = "**_",
    LongDash = "&#8212;",
    Black = "\\u001b[30m",
    Red = "\\u001b[31",
    Green = "\\u001b[32m",
    Yellow = "\\u001b[33m",
    Blue = "\\u001b[34m", // "<span style=\"color:blue\">"  "</style>"
    Magenta = "\\u001b[35",
    Cyan = "\\u001b[36m",
    White = "\\u001b[37m"
}

enum MarkdownStringMode
{
    Class,
    Code,
    Config,
    Deprecated,
    Link,
    Method,
    Normal,
    Private,
    Property,
    Param,
    Returns,
    Since,
    Singleton
}


export class CommentParser
{

    private boldItalic(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.BoldItalicStart + text +
               MarkdownChars.BoldItalicEnd + (trailingSpace ? " " : "");
    }


    private bold(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.Bold + text + MarkdownChars.Bold +
               (trailingSpace ? " " : "");
    }


	private getMode(line: string): MarkdownStringMode | undefined
	{
		let mode;
		if (line.startsWith("@"))
		{
			const tag = line.trim().substring(0, line.indexOf(" ") !== -1 ? line.indexOf(" ") : line.length);
			switch (tag)
			{
				case "@cfg":
				case "@config":
					mode = MarkdownStringMode.Config;
					break;
				case "@class":
					mode = MarkdownStringMode.Class;
					break;
				// case "{@link":
				//     mode = MarkdownStringMode.Link;
				//     break;
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
				case "@inheritdoc":
				default:
					break;
			}
			log.value("      found @ tag", tag, 4);
			log.value("      set mode", mode?.toString(), 4);
		}
		else if (line.length > 3 && (line.substring(0, 3) === "   " || line[0] === "\t"))
		{
			mode = MarkdownStringMode.Code;
		}
		return mode;
	}


	private handleClassLine(line: string, markdown: MarkdownString)
    {
        let classLine = line.trim();
        if (classLine.match(/@[\w]+ /))
        {
            const lineParts = line.trim().split(" ");
            classLine = this.italic(lineParts[0], false, true);
            if (lineParts.length > 1)
            {
                lineParts.shift();
                classLine += this.bold(lineParts[0], true, true);
                if (lineParts.length > 1)
                {
                    lineParts.shift();
                    classLine += MarkdownChars.NewLine + lineParts.join(" ");
                }
            }
        }
        log.value("      insert class line", classLine, 5);
        markdown.appendMarkdown(classLine);
    }


    private handleDeprecatedLine(line: string, markdown: MarkdownString)
    {
        let textLine = line.trim();
        textLine = this.italic(textLine, false, true);
        log.value("      insert deprecated line", textLine, 5);
        markdown.appendMarkdown(textLine);
    }


    private handleObjectLine(line: string, property: string, markdown: MarkdownString)
    {
        let cfgLine = "";
        if (line.startsWith("@")) {
            const lineParts = line.split(property);
            cfgLine = lineParts[0] + this.boldItalic(property) + " " + lineParts[1];
        }
        else {
            cfgLine = line.trim();
        }
        log.value("      insert object line", cfgLine, 5);
        markdown.appendMarkdown(cfgLine);
    }


    private handleParamLine(line: string, trailers: string[], useCode: boolean, markdown: MarkdownString)
    {
        if (!line.startsWith("@"))
        {
            log.value("      insert param text line", line, 5);
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
            if (!lineParts[1].match(/\{[A-Z(\[\])]+\}/i))
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

        log.value("          name", lineProperty, 5);

        if (lineType)
        {
            lineType = lineType.replace("*", "any").replace(/[\{\}]/g, "");
            log.value("          type", lineType, 5);
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

        let paramLine: string;

        if (!useCode) {
            paramLine = this.italic("@param", false, true) + this.boldItalic(lineProperty, false, true) +
                        this.italic(MarkdownChars.TypeWrapBegin + lineType + MarkdownChars.TypeWrapEnd);
            if (lineTrail) {
                paramLine += (" " + MarkdownChars.LongDash + lineTrail);
            }
            if (!markdown.value.endsWith(MarkdownChars.NewLine)) {
                markdown.appendMarkdown(MarkdownChars.NewLine);
            }
            markdown.appendMarkdown(paramLine);
        }
        else {
            paramLine = lineProperty + " " + MarkdownChars.TypeWrapBegin + lineType + MarkdownChars.TypeWrapEnd;
            if (lineTrail) {
                paramLine += " - " + lineTrail;
            }
            markdown.appendCodeblock(paramLine);
        }

        log.value("      param line", paramLine, 5);

        if (lineValue)
        {
            trailers.push(MarkdownChars.NewLine + "- " + this.italic("Defaults to:") + " `" +
                        lineValue.replace(/`/g, "") + "`" +  MarkdownChars.NewLine +  MarkdownChars.NewLine);
        }
        else {
            markdown.appendMarkdown(MarkdownChars.NewLine);
        }
    }


    private handleReturnsLine(line: string, markdown: MarkdownString)
    {
        const rtnLineParts = line.trim().split(" ");
        let rtnLine = MarkdownChars.Italic + rtnLineParts[0] + MarkdownChars.Italic + " ";
        rtnLineParts.shift();
        rtnLine += rtnLineParts.join(" ");
        rtnLine = rtnLine.replace(/\*@return[s]{0,1}\* \{[A-Za-z]+\}/, (matched) => {
            return matched.replace(/\{[A-Za-z]+\}/, (matched2) => {
                return this.italic(matched2.replace("{", MarkdownChars.TypeWrapBegin)
                                    .replace("}", MarkdownChars.TypeWrapEnd));
            });
        });
        log.value("      insert returns line", rtnLine, 5);
        markdown.appendMarkdown(MarkdownChars.NewLine + rtnLine);
    }


    private handleTagLine(line: string, markdown: MarkdownString)
    {
        let textLine = line.trim();
        textLine = this.italic(textLine, false, true);
        log.value("      insert tag line", textLine, 5);
        markdown.appendMarkdown(textLine);
    }


    private handleTextLine(line: string, markdown: MarkdownString)
    {
        let textLine = line.trim();
        if (textLine.match(/@[\w]+ /))
        {
            const lineParts = line.trim().split(" ");
            textLine = this.italic(lineParts[0], false, true);
            if (lineParts.length > 1) {
                lineParts.shift();
                textLine += lineParts.join(" ");
            }
        }
        if (textLine.match(/\{\s*@link [\w]+\s*\}/))
        {
            textLine = textLine.replace(/\{\s*@link [\w]+\s*\}/, (matched) => {
                return this.boldItalic(matched);
        });
        }
        log.value("      insert text line", textLine, 5);
        markdown.appendMarkdown(textLine);
    }


    private italic(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
    {
        return (leadingSpace ? " " : "") + MarkdownChars.Italic + text +
            MarkdownChars.Italic + (trailingSpace ? " " : "");
    }


    toMarkdown(property: string, comment: string | undefined, logPad = ""): MarkdownString | undefined
    {
        if (!comment || !property) {
            return;
        }

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

        log.methodStart("build markdown string from comment", 4, logPad, false, [["comment", comment]]);

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

        const docLines = commentFmt.split(/\r{0,1}\n{1}\s*\*( |$)/),
              maxLines = 75;
        let mode: MarkdownStringMode | undefined,
            indented = "",
            previousMode: MarkdownStringMode | undefined,
            trailers: string[] = [],
            currentLine = 0;

        for (let line of docLines)
        {
            if (!line.trim()) {
                continue;
            }

            if (currentLine === 0 && line.includes("eslint")) {
                continue;
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

            log.value("   process line", line, 4);

            if (!line.trim()) {
                continue;
            }

            mode = this.getMode(line);

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
                this.handleObjectLine(line, property, markdown);
            }
            else if (mode === MarkdownStringMode.Class)
            {
                this.handleClassLine(line, markdown);
            }
            else if (mode === MarkdownStringMode.Param)
            {
                this.handleParamLine(line, trailers, currentLine === 0, markdown);
            }
            else if (mode === MarkdownStringMode.Code)
            {
                log.value("      indented line", line, 5);
                indented += MarkdownChars.NewLine + line.trim();
            }
            else if (mode === MarkdownStringMode.Returns)
            {
                this.handleReturnsLine(line, markdown);
            }
            else if (mode === MarkdownStringMode.Deprecated)
            {
                this.handleDeprecatedLine(line, markdown);
            }
            else if (mode === MarkdownStringMode.Singleton)
            {
                this.handleTagLine(line, markdown);
            }
            else
            {
                this.handleTextLine(line, markdown);
            }

            ++currentLine;
            if (currentLine >= maxLines) {
                break;
            }
        }

        log.methodDone("build markdown string from comment", 4, logPad);
        return markdown;
    }

}