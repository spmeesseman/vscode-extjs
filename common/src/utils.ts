


export async function forEachAsync(array: any, callback: any)
{
    for (let index = 0; index < array.length; index++) {
        const result = await callback(array[index], index, array);
        if (result === false) {
            break;
        }
    }
}


export async function forEachMapAsync(map: any, callback: any)
{
    for (const entry of map.entries()) {
        const result = await callback(entry[1], entry[0], map);
        if (result === false) {
            break;
        }
    }
}


export function isExtJsFile(documentText: string | undefined)
{
    return documentText && documentText.includes("Ext.define");
}


export function isGetterSetter(method: string): boolean
{
    return method.startsWith("get") || method.startsWith("set") && method[3] >= "A" && method[3] <= "Z";
}


export function isNeedRequire(componentClass: string | undefined)
{
    if (!componentClass || componentClass.startsWith("Ext.")) {
        return false;
    }
    return true;
}


export function lowerCaseFirstChar(text: string)
{
    return text.replace(/(?:^\w|[A-Za-z]|\b\w)/g, (letter, index) => {
        return index !== 0 ? letter : letter.toLowerCase();
    });
}


export function properCase(name: string)
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
