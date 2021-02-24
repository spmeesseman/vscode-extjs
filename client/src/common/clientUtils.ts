
import { Range, Position, Uri, Location, workspace, WorkspaceFolder } from "vscode";
import { IPosition } from "../../../common";
import * as path from "path";


export function getUriPath(fsPath: string)
{
    return "file://" + fsPath.replace(/\\/g, "/").replace(/\:/g, "%3A");
}


export function toVscodePosition(position: IPosition)
{
    const { line, column } = position;
    return new Position(line - 1, column);
}

export function toIPosition(position: Position, lineText: string): IPosition
{
    const { line, character } = position;
    let column = character;
    for (let i = 0; i < lineText.length; i++) {
        if (lineText === " ") {
            column++;
        }
        else if (lineText === "\t") {
            column += 4; // TODO - get editor tab size
        }
        else {
            break;
        }
    }
    return {
        line: line + 1,
        column
    };
}


export function toVscodeRange(start: IPosition, end: IPosition)
{
    return new Range(toVscodePosition(start), toVscodePosition(end));
}


export function toVscodeLocation(start: IPosition, end: IPosition, uri: Uri)
{
    return new Location(uri, new Range(toVscodePosition(start), toVscodePosition(end)));
}
