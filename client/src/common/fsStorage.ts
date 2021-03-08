
import * as fs from "fs";
import * as path from "path";
import {
    ExtensionContext
} from "vscode";

export let fsStorage: Storage | undefined;


export const initFsStorage = (context: ExtensionContext) =>
{
    fsStorage = new Storage(context.globalStoragePath);
};

class Storage
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


    private checkProjectDir(project: string): string | boolean
    {
        let storagePath: string | boolean = false;
        if (this.baseStoragePath && project)
        {
            const projectStoragePath = path.join(this.baseStoragePath, project);
            try {
                if (!fs.existsSync(projectStoragePath))
                {
                    fs.mkdirSync(projectStoragePath, {
                        recursive: true
                    });
                }
                storagePath = projectStoragePath;
            }
            catch {}
        }
        return storagePath;
    }


    private checkKeyPath(key: string)
    {
        let keyPath: string | boolean = false;
        if (key)
        {
            const dKeyPath = path.dirname(key);
            try {
                if (!fs.existsSync(dKeyPath))
                {
                    fs.mkdirSync(dKeyPath, {
                        recursive: true
                    });
                }
                keyPath = dKeyPath;
            }
            catch {}
        }
        return keyPath;
    }


    public clear()
    {
        if (this.baseStoragePath && fs.existsSync(this.baseStoragePath)) {
            fs.rmdirSync(this.baseStoragePath, {
                recursive: true
            });
        }
    }


    public get(project: string, key: string, defaultValue?: string): string | undefined
    {
        let value: string | undefined = defaultValue;
        if (project && key)
        {
            const projectDir = this.checkProjectDir(project);
            if (typeof projectDir === "string") {
                try {
                    const dataFile = path.join(projectDir, key);
                    if (fs.statSync(dataFile)) {
                        value = fs.readFileSync(dataFile).toString();
                    }
                }
                catch {}
            }
        }
        return value;
    }


    public async update(project: string, key: string, value: string)
    {
        if (project && key)
        {
            const projectDir = this.checkProjectDir(project);
            if (typeof projectDir === "string")
            {
                const keyPath = path.join(projectDir, key);
                if (this.checkKeyPath(keyPath)) {
                    fs.writeFileSync(keyPath, value);
                }
            }
        }
    }

}
