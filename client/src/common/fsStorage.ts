
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


    private checkKeyPath(key: string): string | boolean
    {
        let storagePath: string | boolean = false;
        if (this.baseStoragePath && key)
        {
            const projectStoragePath = path.join(this.baseStoragePath, key);
            try {
                if (!fs.existsSync(projectStoragePath))
                {
                    fs.mkdirSync(path.dirname(projectStoragePath), {
                        recursive: true
                    });
                }
                storagePath = projectStoragePath;
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
            if (typeof key === "string") {
                try {
                    if (fs.statSync(key)) {
                        value = fs.readFileSync(key).toString();
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
            if (storagePath && typeof storagePath === "string") {
                fs.writeFileSync(storagePath, value);
            }
        }
    }

}
