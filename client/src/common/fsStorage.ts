
import * as fs from "../../../common/lib/fs";
import * as path from "path";
import {
    ExtensionContext
} from "vscode";
import { getUserDataPath } from "./clientUtils";

class FsStorage
{
    private baseStoragePath: string;


    constructor(storagePath: string)
    {
        this.baseStoragePath = storagePath;
    }


    private async checkKeyPath(key: string)
    {
        const storagePath = path.join(this.baseStoragePath, key);
        if (!fs.pathExists(storagePath)) {
            await fs.createDir(storagePath);
        }
        try {
            if (!(await fs.pathExists(storagePath)))
            {
                await fs.createDir(path.dirname(storagePath));
            }
        }
        catch {}
        return storagePath;
    }


    public async clear()
    {
        if (this.baseStoragePath && await fs.pathExists(this.baseStoragePath)) {
            await fs.deleteDir(this.baseStoragePath);
        }
    }


    public async get(key: string, defaultValue?: string)
    {
        let value: string | undefined = defaultValue;
        const storagePath = await this.checkKeyPath(key);
        try {
            if (await fs.pathExists(storagePath)) {
                value = (await fs.readFile(storagePath)).toString();
            }
        }
        catch {}
        return value;
    }


    public async update(key: string, value: string)
    {
        try {
            await fs.writeFile(await this.checkKeyPath(key), value);
        }
        catch {}
    }

}

export let fsStorage = new FsStorage(getUserDataPath());


export const initFsStorage = (context: ExtensionContext) =>
{
    fsStorage = new FsStorage(context.globalStoragePath);
};
