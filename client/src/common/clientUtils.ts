
import * as os from "os";
import * as path from "path";
import * as minimatch from "minimatch";
import { Range, Position, TextDocument, EndOfLine, Uri, workspace } from "vscode";
import { IPosition, IComponent, extjs, IExtJsBase, IPrimitive, IObjectRange, readFile } from "../../../common";
import { configuration } from "./configuration";
import { existsSync } from "fs";
import G from "glob";


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


export function getWorkspaceProjectName(fsPath: string)
 {
     let project = path.basename(fsPath);
     const wsf = workspace.getWorkspaceFolder(Uri.file(fsPath));
     if (wsf) {
         project = path.basename(wsf.uri.fsPath);
     }
     return project;
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
    // return extjs.isPositionInRange(toIPosition(position), toIRange(range));
}


export function isPrimitive(object: any): object is IPrimitive
{
    return object !== undefined && !isComponent(object) && !("declaration" in object);
}


export function getMethodByPosition(position: Position, component: IComponent)
{   //
    // Return first found, this will be the outer function object
    //
    return component.methods.find(m => isPositionInRange(position, toVscodeRange(m.start, m.end)));
}


// export function getObjectRangePropertyValue(property: string, objectRange: IObjectRange, document: TextDocument)
// {   //
//     // Return last found, this will be the most inner object
//     //
//     const jso: any = {};
//     try {
//         JSON.parse(document.getText(toVscodeRange(objectRange.start, objectRange.end)));
//     }
//     catch {}
//     return jso[property];
// }


export function getObjectRangeByPosition(position: Position, component: IComponent)
{   //
    // Return last found, this will be the most inner object
    //
    const ranges: IObjectRange[] = [];
    ranges.push(...component.objectRanges.filter(o => isPositionInRange(position, toVscodeRange(o.start, o.end))));
    return ranges.length > 0 ? ranges[ranges.length - 1] : undefined;
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


export function isPositionInObjectRange(position: Position, component: IComponent)
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


export function quoteChar()
{
    return configuration.get<string>("quoteCharacter", "single") === "single" ? "'" : "\"";
}


export const defaultIgnoreTypes: string[] = [
    "boolean",
    "date",
    "number",
    "object",
    "string"
];


export async function shouldIgnoreType(type: string)
{
    const ignoreTypes = configuration.get<string[]>("ignoreTypes", defaultIgnoreTypes);
    return ignoreTypes.includes(type.replace(/["']/g, ""));
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


export function toIPosition(position: Position): IPosition
{
    return {
        line: position.line + 1,
        column: position.character
    };
}


// export function toIRange(range: Range): IRange
// {
//     return {
//         start: toIPosition(range.start),
//         end: toIPosition(range.end)
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
