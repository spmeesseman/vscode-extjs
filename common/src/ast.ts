
import { parse } from "@babel/parser";
import {
	Expression, isArrayExpression, isBooleanLiteral, isExpression, isIdentifier,
	isNullLiteral, isObjectExpression, isObjectProperty, isStringLiteral, Node, SpreadElement
} from "@babel/types";


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

export function getComponentsAst(text: string, logErrFn?: (arg: string | Error) => void)
{
	let ast: Node | undefined;
	try {
		ast = parse(text);
	}
	catch (ex) {
		if (logErrFn) {
			logErrFn(ex);
		}
	}
	return ast;
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
