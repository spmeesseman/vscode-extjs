
import { parse } from "@babel/parser";
import {
    Node
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
