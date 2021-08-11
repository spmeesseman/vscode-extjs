
import * as fs from "fs";
import * as path from "path";
import {
    ExtensionContext
} from "vscode";

export let fsStorage: FsStorage | undefined;


export const initFsStorage = (context: ExtensionContext) =>
{
    fsStorage = new FsStorage(context.globalStoragePath);
};

class FsStorage
{

    private baseStoragePath: string | undefined;


    constructor(storagePath: string)
    {
        this.baseStoragePath = storagePath;
        if (!fs.existsSync(storagePath))
        {
            fs.mkdirSync(storagePath);
        }
    }


    private checkKeyPath(key: string): string | undefined
    {
        let storagePath: string | undefined;
        if (this.baseStoragePath && key)
        {
            storagePath = path.join(this.baseStoragePath, key);
            try {
                if (!fs.existsSync(storagePath))
                {
                    fs.mkdirSync(path.dirname(storagePath), {
                        recursive: true
                    });
                }
            }
            catch {}
        }
        return storagePath;
    }


    public clear()
    {
        if (this.baseStoragePath && fs.existsSync(this.baseStoragePath)) {
            fs.rmdirSync(this.baseStoragePath, {
                recursive: true
            });
        }
    }


    public get(key: string, defaultValue?: string): string | undefined
    {
        let value: string | undefined = defaultValue;
        if (key)
        {
            const storagePath = this.checkKeyPath(key);
            if (storagePath) {
                try {
                    if (fs.statSync(storagePath)) {
                        value = fs.readFileSync(storagePath).toString();
                    }
                }
                catch {}
            }
        }
        return value;
    }


    public async update(key: string, value: string)
    {
        if (key)
        {
            const storagePath = this.checkKeyPath(key);
            if (storagePath) {
                fs.writeFileSync(storagePath, value);
            }
        }
    }

}
