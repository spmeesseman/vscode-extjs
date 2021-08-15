
import { parse } from "@babel/parser";
import {
    labeledStatement, identifier, expressionStatement, arrayExpression, Node
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
		return labeledStatement(identifier("a"), expressionStatement(arrayExpression([])));
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
