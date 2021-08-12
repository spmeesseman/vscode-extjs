import {
    Memento, ExtensionContext
} from "vscode";

class Storage
{
    private storage: Memento | undefined;

    constructor(storageMemento?: Memento)
    {
        this.storage = storageMemento ?? undefined;
    }

    public get<T>(key: string, defaultValue?: T): T | undefined
    {
        if (defaultValue)
        {
            return this.storage?.get<T>(key, defaultValue);
        }
        return this.storage?.get<T>(key);
    }

    public async update(key: string, value: any)
    {
        await this.storage?.update(key, value);
    }
}


export let storage: Memento = new Storage();

export const initStorage = (context: ExtensionContext) =>
{
    //
    // Set up extension custom storage
    //
    storage = new Storage(context.globalState);
};