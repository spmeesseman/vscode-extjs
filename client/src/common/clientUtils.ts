
import * as os from "os";
import * as path from "path";
import * as minimatch from "minimatch";
import { Range, Position, TextDocument, EndOfLine, Uri } from "vscode";
import { IPosition, IComponent, IMethod, IExtJsBase, IPrimitive } from "../../../common";
import { configuration } from "./configuration";
import { existsSync } from "fs";


export function documentEol(document: TextDocument)
{
    return document.eol === EndOfLine.CRLF ? "\r\n" : "\n";
}


/**
 * Checks if a value exists in the given array
 *
 * * **IMPORTANT**  This function will return 0 on success if the item is the 1st in the array,
 * always check for a return value of false, and not just using a !existsInArray to determine if
 * the item exists
 *
 * @param arr The array to check
 * @param item The value to check in the given array for
 * @returns The index of the item in the array if the value exists in the arrray, `false` otherwise
 */
 export function existsInArray(arr: any[], item: any): boolean | number
 {
     for (let i = 0; i < arr.length; i++) {
         if (item === arr[i]) {
             return i;
         }
     }
     return false;
 }


export function isComponent(object: IExtJsBase| undefined): object is IComponent
{
    return object !== undefined && "baseNameSpace" in object;
}


export function isExcluded(uriPath: string)
{
    function testForExclusionPattern(path: string, pattern: string): boolean
    {
        return minimatch(path, pattern, { dot: true, nocase: true });
    }

    const exclude = configuration.get<string[]>("exclude", []);
    for (const pattern of exclude) {
        if (testForExclusionPattern(uriPath, pattern)) {
            return true;
        }
    }

    return false;
}


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


export function isPrimitive(object: any): object is IPrimitive
{
    return object !== undefined && !isComponent(object) && !("declaration" in object);
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


export function getObjectRangeByPosition(position: Position, component: IComponent)
{
    for (const o of component.objectRanges)
    {
        if (isPositionInRange(position, toVscodeRange(o.start, o.end))) {
            return o;
        }
    }
}


export function getPortableDataPath()
{
    if (process.env.VSCODE_PORTABLE)
    {
        const uri = Uri.parse(process.env.VSCODE_PORTABLE);
        if (uri)
        {
            if (existsSync(uri.fsPath))
            {
                try {
                    const fullPath = path.join(uri.fsPath, "user-data", "User");
                    return fullPath;
                }
                catch (e) {
                    return;
                }
            }
        }
    }
    return;
}


export function getUserDataPath(platform?: string)
{
    let userPath: string | undefined = "";

    //
    // Check if data path was passed on the command line
    //
    if (process.argv)
    {
        let argvIdx = existsInArray(process.argv, "--user-data-dir");
        if (argvIdx !== false && typeof argvIdx === "number" && argvIdx >= 0 && argvIdx < process.argv.length) {
            userPath = path.resolve(process.argv[++argvIdx]);
            return userPath;
        }
    }
    //
    // If this is a portable install (zip install), then VSCODE_PORTABLE will be defined in the
    // environment this process is running in
    //
    userPath = getPortableDataPath();
    if (!userPath)
    {   //
        // Use system user data path
        //
        userPath = getDefaultUserDataPath(platform);
    }
    userPath = path.resolve(userPath);
    return userPath;
}


function getDefaultUserDataPath(platform?: string)
{   //
    // Support global VSCODE_APPDATA environment variable
    //
    let appDataPath = process.env.VSCODE_APPDATA;
    //
    // Otherwise check per platform
    //
    if (!appDataPath) {
        switch (platform || process.platform) {
            case "win32":
                appDataPath = process.env.APPDATA;
                if (!appDataPath) {
                    const userProfile = process.env.USERPROFILE || "";
                    appDataPath = path.join(userProfile, "AppData", "Roaming");
                }
                break;
            case "darwin":
                appDataPath = path.join(os.homedir(), "Library", "Application Support");
                break;
            case "linux":
                appDataPath = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
                break;
            default:
                throw new Error("Platform not supported");
        }
    }
    return path.join(appDataPath, "vscode");
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
