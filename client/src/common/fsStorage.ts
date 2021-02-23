
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

    public get(project: string, key: string, defaultValue?: string): string | undefined
    {
        if (project && key)
        {
            const projectDir = this.checkProjectDir(project);
            if (typeof projectDir === "string") {
                try {
                    const dataFile = path.join(projectDir, key);
                    if (fs.statSync(dataFile)) {
                        return fs.readFileSync(dataFile).toString();
                    }
                    return defaultValue;
                }
                catch {}
            }
        }
        return undefined;
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

    private checkProjectDir(project: string): string | boolean
    {
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
                return projectStoragePath;
            }
            catch {}
        }
        return false;
    }


    private checkKeyPath(key: string)
    {
        if (key)
        {
            const keyPath = path.dirname(key);
            try {
                if (!fs.existsSync(keyPath))
                {
                    fs.mkdirSync(keyPath, {
                        recursive: true
                    });
                }
                return keyPath;
            }
            catch {}
        }
        return false;
    }
}
