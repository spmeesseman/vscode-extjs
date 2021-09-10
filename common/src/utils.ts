import { IPosition, IRange } from ".";


export function atob(str: string): string
{
    return Buffer.from(str, "base64").toString("binary");
}


export function btoa(str: string): string
{
    return Buffer.from(str, "binary").toString("base64");
}


/**
 * Checks if a value exists in the given array
 *
 * * **IMPORTANT**  This function will return 0 on success if the item is the 1st in the array,
 * always check for a return value of false, and not just using a !existsInArray to determine if
 * the item exists
 *
 * @since 0.8.0
 * @param arr The array to check
 * @param item The value to check in the given array for
 * @returns The index of the item in the array if the value exists in the arrray, `false` otherwise
 */
 export function existsInArray(arr: any[], item: any): boolean | number
 {
     if (isArray(arr))
     {
        for (let i = 0; i < arr.length; i++)
        {
            if (item === arr[i]) {
                return i;
            }
        }
    }
     return false;
 }


export function isArray(value: any)
{
    return !!value && Array.isArray(value);
}


export function isBoolean(value: any)
{
    return !!value && typeof value === "boolean";
}


export function isExtJsFile(documentText: string | undefined)
{
    const regex = /Ext\.define\s*\([\r\n]*['"]{1}[\r\n,a-zA-Z0-9.]+['"]{1}\s*,\s*[\r\n]*\s*{/m;
    return !!documentText && documentText.trim() ? regex.test(documentText) : false;
}


export function isFunction(value: any)
{
    return !!value && typeof value === "function";
}


export function isGetterSetter(method: string): boolean
{
    return !!method && method.length > 3 && (method.startsWith("get") || method.startsWith("set")) && method[3] >= "A" && method[3] <= "Z";
}


export function isLowerCase(value: string)
{
    return !!value && value === value.toLowerCase() && value !== value.toUpperCase();
}


export function isNumeric(value: string | number): boolean
{
    try {
        return ((value !== null) && (value !== undefined) &&
                (value !== "") && !isNaN(Number(value.toString())));
    }
    catch (e) {
        return false;
    }
}


export function isObject(value: any)
{
    return !!value && value instanceof Object || typeof value === "object";
}


export function isPositionInRange(position: IPosition, range: IRange)
{
    if (position.line > range.start.line && position.line < range.end.line) {
        return true;
    }
    else if (position.line === range.start.line)
    {
        return position.column >= range.start.column;
    }
    else if (position.line === range.end.line)
    {
        return position.column <= range.end.column;
    }
    return false;
}


export function isString(value: any): value is string
{
    return (!!value || value === "") && value instanceof String || typeof value === "string";
}


export function isUpperCase(value: string)
{
    return !!value && value !== value.toLowerCase() && value === value.toUpperCase();
}


export function lowerCaseFirstChar(text: string)
{
    return text.replace(/(?:^\w|[A-Za-z]|\b\w)/g, (letter, index) => {
        return index !== 0 ? letter : letter.toLowerCase();
    });
}


export function pick<T, K extends keyof T>(obj: T, ...keys: K[])
{
    const ret: any = {};
    keys.forEach(key => {
      ret[key] = obj[key];
    });
    return ret;
}


export function pushIfNotExists(arr: any[], item: any)
{
    if (item && arr.indexOf(item) === -1) {
        arr.push(item);
    }
}


export function removeFromArray(arr: any[], item: any)
{
    if (isArray(arr))
     {
        let idx = -1;
        let idx2 = -1;

        for (const a of arr)
        {
            idx++;
            if (item === a) {
                idx2 = idx;
                return false;
            }
        }

        if (idx2 !== -1 && idx2 < arr.length) {
            arr.splice(idx2, 1);
        }
    }
}


/**
 * Camel case a string
 *
 * @param name The string to manipulate
 * @param indexUpper The index of the string to upper case
 */
export function toCamelCase(name: string | undefined, indexUpper: number)
{
    if (!name || indexUpper <= 0 || indexUpper >= name.length) {
      return name;
    }

    return name
        .replace(/(?:^\w|[A-Za-z]|\b\w)/g, (letter, index) => {
            return index !== indexUpper ? letter.toLowerCase() : letter.toUpperCase();
        })
        .replace(/[\s\-]+/g, "");
}


export function toProperCase(name: string)
{
    if (!name) {
      return name;
    }

    return name
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
            return index !== 0 ? letter.toLowerCase() : letter.toUpperCase();
        })
        .replace(/[\s]+/g, "");
}


export function timeout(ms: number)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}


export function toRange(start: IPosition, end: IPosition): IRange
{
    return {
        start, end
    };
}
