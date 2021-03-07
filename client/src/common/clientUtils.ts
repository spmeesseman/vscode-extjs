
import { Range, Position, Uri, Location, window } from "vscode";
import { IPosition, IComponent, IMethod } from "../../../common";


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


export function getMethodByPosition(position: Position, component: IComponent)
{
    let method: IMethod | undefined;
    for (const m of component.methods)
    {
        if (isPositionInRange(position, toVscodeRange(m.start, m.end))) {
            method = m;
            break;
        }
    }
    return method;
}


export function isPositionInObject(position: Position, component: IComponent)
{
    let isInObject = false;

    for (const o of component.objectRanges)
    {
        isInObject = isPositionInRange(position, toVscodeRange(o.start, o.end));
        if (isInObject) {
            break;
        }
    }

    if (!isInObject)
    {
        const method = getMethodByPosition(position, component);
        if (!method) {
            isInObject = isPositionInRange(position, toVscodeRange(component.bodyStart, component.bodyEnd));
        }
        else
        {
            for (const o of method.objectRanges)
            {
                isInObject = isPositionInRange(position, toVscodeRange(o.start, o.end));
                if (isInObject) {
                    break;
                }
            }
        }
    }

    return isInObject;
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


// export function toVscodeLocation(start: IPosition, end: IPosition, uri: Uri)
// {
//     return new Location(uri, new Range(toVscodePosition(start), toVscodePosition(end)));
// }
