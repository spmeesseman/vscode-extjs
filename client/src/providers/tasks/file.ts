
import { ThemeIcon, TreeItem, TreeItemCollapsibleState, TaskDefinition, ExtensionContext, Uri } from "vscode";
import * as path from "path";
import { pathExists, utils } from "../../../../common";
import { configuration } from "../../common/configuration";
import TaskItem from "./item";
import TaskFolder  from "./folder";


/**
 * @class TaskFile
 *
 * A tree node that represents a task type/source (e.g. `npm`, `gulp`, etc...).
 *
 * A TaskFile can be a direct child of TaskFolder, or, if `grouping` is turned in in
 * Settings, it can be a child of another TaskFile.
 *
 * The last TaskFile in a grouping will contain items of type TaskItem.  If not grouped,
 * the TaskFile node for each task type within each TaskFolder will contain items of type TaskItem.
 */
export default class TaskFile extends TreeItem
{
    public path: string;
    /**
     * @property folder
     *
     * The owner TaskFolder representing a workspace or special (Last Tasks / Favorites)
     * folder.
     */
    public folder: TaskFolder;
    /**
     * @property folder
     *
     * Child TaskItem or TaskFile nodes in the tree.  A TaskFile can own another TaskFile
     * if "Grouping" is turned on in settings.
     */
    public treeNodes: (TaskItem|TaskFile)[] = [];
    /**
     * @property fileName
     *
     * The name of the filesystem file that this TaskFile represents, and/or is associated
     * with if grouped.
     */
    public fileName: string;
    /**
     * @property groupLevel
     *
     * Grouping level of this TaskFIle, if grouping is enabled in Settings.  The maximum
     * group level is configurable in Settings 1-10.
     */
    public groupLevel: number;
    /**
     * @property nodePath ?
     */
    public nodePath: string;
    /**
     * @property taskSource
     *
     * The task source that the TaskFile will be associated with, e.g. `npm`, `ant`,
     * `gulp`, etc.
     *
     * @readonly
     */
    public readonly taskSource: string;
    /**
     * @property isGroup Flag indicating if the TaskFile is being added in grouped mode.
     * @readonly
     */
    public readonly isGroup: boolean;
    /**
     * @property isUser Flag indicating if the TaskFile is associated with "User" tasks.
     * @readonly
     */
    public readonly isUser: boolean;


    /**
     * @constructor
     *
     * @param context The VSCode extension context.
     * @param folder The owner TaskFolder, a TaskFolder represents a workspace or special (Last Tasks / Favorites) folder.
     * @param taskDef The task definition.
     * @param source The task source that the TaskFile will be associated with, e.g. `npm`, `ant`, `gulp`, etc.
     * @param relativePath The relative path of the task file, relative to the workspace folder it was found in.
     * @param groupLevel The grouping level in the tree.
     * @param group Flag indicating if the TaskFile is being added in grouped mode.
     * @param label The display label.
     * @param logPad Padding to prepend to log entries.  Should be a string of any # of space characters.
     */
    constructor(context: ExtensionContext, folder: TaskFolder, taskDef: TaskDefinition, source: string, relativePath: string, groupLevel: number, group?: boolean, label?: string, logPad = "")
    {
        super(TaskFile.getLabel(label ? label : source, relativePath, group || false), TreeItemCollapsibleState.Collapsed);

        this.folder = folder;
        this.path = relativePath;
        this.nodePath = relativePath;
        this.taskSource = source;
        this.isGroup = (group === true);
        this.isUser = false;
        this.groupLevel = 0;

        if (group && this.label) {
            this.nodePath = path.join(this.nodePath, this.label.toString());
        }

        if (!this.nodePath) { // force null or undefined to empty string
            this.nodePath = "";
        }

        this.fileName = path.basename(taskDef.fileName);
        if (folder.resourceUri)
        {
            this.resourceUri = Uri.file(path.join(folder.resourceUri.fsPath, relativePath, this.fileName));
        }

        if (!group)
        {
            this.contextValue = "taskFile" + utils.toProperCase(this.taskSource);
        }
        else { //
              // When a grouped node is created, the definition for the first task is passed to this
             // function.  Remove the filename part of tha path for this resource
            //
            this.fileName = "group";      // change to name of directory
            // Use a custom toolip (default is to display resource uri)
            this.tooltip = utils.toProperCase(source) + " Task Files";
            this.contextValue = "taskGroup" + utils.toProperCase(this.taskSource);
            this.groupLevel = groupLevel;
        }

        //
        // Set context icon
        //
        this.iconPath = ThemeIcon.File;

        // this.iconPath = {
        //     light: context.asAbsolutePath(path.join("res", "sources", "extjs.svg")),
        //     dark: context.asAbsolutePath(path.join("res", "sources", "extjs.svg"))
        // };
    }

    /**
     * @method addTreeNode
     *
     * @param treeNode The node/item to add to this TaskFile node.
     */
    public addTreeNode(treeNode: (TaskFile | TaskItem | undefined))
    {
        if (treeNode) {
            treeNode.groupLevel = this.groupLevel;
            this.treeNodes.push(treeNode);
        }
    }


    /**
     * @method getLabel
     *
     * @param treeNode The node/item to add to this TaskFile node.
     */
    private static getLabel(source: string, relativePath: string, group: boolean): string
    {
        if (group !== true && relativePath.length > 0 && relativePath !== ".")
        {
            if (relativePath.endsWith("\\") || relativePath.endsWith("/")) // trim slash chars
            {
                return source + " (" + relativePath.substring(0, relativePath.length - 1).toLowerCase() + ")";
            }
            else {
                return source + " (" + relativePath.toLowerCase() + ")";
            }
        }

        return source.toLowerCase();
    }



    /**
     * @method insertTreeNode
     *
     * @param treeNode The node/item to add to this TaskFile node.
     * @param index The index at which to insert into the array
     */
    public insertTreeNode(treeItem: (TaskFile | TaskItem), index: number)
    {
        this.treeNodes.splice(index, 0, treeItem);
    }


    /**
     * @method removeTreeNode
     *
     * @param treeNode The node/item to remove from this TaskFile node.
     */
    public removeTreeNode(treeItem: (TaskFile | TaskItem))
    {
        let idx = -1;
        let idx2 = -1;

        this.treeNodes.forEach(each =>
        {
            idx++;
            if (treeItem === each)
            {
                idx2 = idx;
            }
        });

        if (idx2 !== -1 && idx2 < this.treeNodes.length)
        {
            this.treeNodes.splice(idx2, 1);
        }
    }

}
