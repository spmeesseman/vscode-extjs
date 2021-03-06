
import { Range, Position, Uri, Location, window } from "vscode";
import { IExtJsBase, IPosition, IComponent } from "../../../common";


export function isPositionInRange(position: Position, range: Range)
{
    if (position.line > range.start.line && position.line < range.end.line) {
        return true;
    }
    else if (position.line === range.start.line)
    {
        return position.character >= range.start.character;
    }
    else if (position.line === range.end.line)
    {
        return position.character <= range.end.character;
    }
    return false;
}


export function isPositionInMethod(position: Position, component: IComponent)
{
    for (const method of component.methods)
    {
        if (isPositionInRange(position, toVscodeRange(method.start, method.end))) {
            return true;
        }
    }
    return false;
}


// export function toIPosition(position: Position, lineText: string): IPosition
// {
//     const { line, character } = position;
//     let column = character;
//     for (let i = 0; i < lineText.length; i++) {
//         if (lineText === " ") {
//             column++;
//         }
//         else if (lineText === "\t") {
//             column += 4; // TODO - how to get editor tab size?
//         }
//         else {
//             break;
//         }
//     }
//     return {
//         line: line + 1,
//         column
//     };
// }


export function toVscodePosition(position: IPosition)
{
    const { line, column } = position;
    return new Position(line - 1, column);
}


export function toVscodeRange(start: IPosition, end: IPosition)
{
    return new Range(toVscodePosition(start), toVscodePosition(end));
}


export function toVscodeLocation(start: IPosition, end: IPosition, uri: Uri)
{
    return new Location(uri, new Range(toVscodePosition(start), toVscodePosition(end)));
}
