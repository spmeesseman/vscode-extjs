
import { parse } from "@babel/parser";
import {
    labeledStatement, identifier, expressionStatement, arrayExpression
} from "@babel/types";


export function getLabeledStatementAst(text: string)
{
	let ast: any;
	try {
		ast = parse(text);
	}
	catch (ex) {
		return labeledStatement(identifier("a"), expressionStatement(arrayExpression([])));
	}
	return ast;
}
