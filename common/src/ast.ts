
import { parse } from "@babel/parser";
import {
	Expression, isArrayExpression, isBooleanLiteral, isExpression, isIdentifier,
	isNullLiteral, isObjectExpression, isObjectProperty, isStringLiteral, Node, SpreadElement
} from "@babel/types";
import { IEdit } from ".";


export function getLabeledStatementAst(text: string, logErrFn?: (arg: string | Error) => void)
{
	let ast: any;
	try {
		ast = parse(text);
	}
	catch (ex) {
		if (logErrFn) {
			logErrFn(ex);
		}
		return parse("a:[]");
	}
	return ast;
}


/**
 * Fault tolerant AST Parser
 *
 * @param text Document text
 * @param editIndexes Edited index information
 * @param logErrFn Callback function to log errors
 */
export function getComponentsAst(text: string, edits: IEdit[], logErrFn?: (arg: string | Error) => void)
{
	let ast: Node | undefined;
/*
    try {
		ast = parse(text);
	}
	catch (ex)
    {
        if (logErrFn) {
			// logErrFn(ex);
		}
	    return { ast, text };
    }
	return { ast, text };
*/
	try {
		ast = parse(text);
	}
	catch (ex)
    {
        if (ex.name === "SyntaxError")
        {
            let success = false;
            //
            // Try removing some characters at and around the edits, trim off
            // one character at a time starting from the end position of the edit
            // moving toward the start position.
            //
            // We care about the current edit text, and not about what was replaced.  The
            // IEdit object specifies the entered text, the rest of the info indicates things
            // about the range being replaced.  We care about the start position of the range
            // being replaced, and the length of the new text.  If the user is typing, this
            // will be 0 characters.  WHen copying/pasting, it could be any size.
            //
            for (const edit of edits)
            {
                let end = edit.start + edit.text.length;
                if (edit.start === end) {
                    end++;
                }
                for (let tryNum = end; tryNum >= edit.start && end >= 0; tryNum--)
                {
                    text = text.substring(0, end - 1) + text.substring(end);
                    try {
                        ast = parse(text);
                        success = true;
                        if (logErrFn) {
                            logErrFn("cut " + (end - 1).toString() + " , " + end.toString());
                        }
                        break;
                    }
                    catch (ex) {
                        if (logErrFn && tryNum === edit.start) {
                            logErrFn(ex);
                        }
                    }
                    end--;
                }
            }

            //
            // Try to parse the syntax error.  THis rarely works since the error usually
            // occurs on a separate line from the actual edit.
            //
            if (!success)
            {
                const match = ex.message.match(/[\w \-]+ \((?:([0-9]+):([0-9]+))\)/);
                if (match)
                {
                    const [ _, line, column ] = match;
                    if (line && column)
                    {
                        let idx = 0;
                        try {
                            const nLine = parseInt(line, 10);
                            for (let i = 1; i < nLine; i++) {
                                idx = text.indexOf("\n", idx) + 1;
                            }
                            text = text.substring(0, idx) + text.substring(text.indexOf("\n", idx) + 1);
                            ast = parse(text);
                        }
                        catch (ex) {
                            if (logErrFn) {
                                logErrFn(ex);
                            }
                        }
                    }
                }
            }
        }
		else if (logErrFn) {
			logErrFn(ex);
		}
	}
	return { ast, text };
}


export function jsAstToLiteralObject(ast: Expression | SpreadElement | null)
{
    if (isNullLiteral(ast)) {
        return null;
    }
    else if (isStringLiteral(ast) || isBooleanLiteral(ast)) {
        return ast.value;
    }
    else if (isArrayExpression(ast)) {
        const out: any = [];
        for (const i in ast.elements)
        {
            out.push(jsAstToLiteralObject(ast.elements[i]));
        }
        return out;
    }
    else if (isObjectExpression(ast))
    {
        const out: any = {};
        for (const k in ast.properties)
        {
            const p = ast.properties[k];
            if (isObjectProperty(p) && isIdentifier(p.key))
            {
                if (isExpression(p.value)) {
                    out[p.key.name] = jsAstToLiteralObject(p.value);
                }
            }
            // else {
            //     //
            //     // TODO - log error
            //     // throw new Error("object should contain only string-valued properties");
            //     //
            // }
        }
        return out;
    }
}
