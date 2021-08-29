
import { Range } from "vscode-languageserver";
import { IPosition } from "../../../common";


export function toVscodePosition(position: IPosition)
{
    const { line, column } = position;
	return {
		line: line - 1,
		character: column
	};
}


export function toVscodeRange(start: IPosition, end: IPosition): Range
{
	return {
		start: toVscodePosition(start),
		end: toVscodePosition(end)
	};
}
