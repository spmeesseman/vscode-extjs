# VSCODE-EXTJS CHANGE LOG

## Version 0.14.0 (September 21st, 2021)

### Bug Fixes

- **Validation:** the 'requires' validation should consider the 'requires' properties of all hierarchical component classes included, as well as the included classes from extended classes and Ext.app.Application.
- **Jsdoc Parser:** params that define as more than one type, e.g. {String|Boolean}, are not parsed/found.
- **Config Parser:** classpath values with the ${toolkit.name} build property in the path do not get found/parsed when reading a package.json file for the a package listed in workspace.json.

### Features

- **Hover:** add link processing to jsdoc

## Version 0.13.0 (September 12th, 2021)

### Bug Fixes

- **Completion:** inline completion is still active in comments with certain line conditions.
- **Definition:** does not work for inline properties that have a trailing inline method call expression
- **Completion:** local variables that are set with multiple up/down/left/right calls are not indexed properly.

### Features

- **Hover:** form basic hover doc for items that do not contain actual jsdoc

## Version 0.12.1 (September 9th, 2021)

### Bug Fixes

- **Hover:** some code blocks are not properly formatted in the markdown
- **Hover:** doc has multiple new lines in random spots
- **Hover:** method parameters list in 2nd line is showing type for some params instead of param name.
- **Completion:** completion is active within comments when typing a new word that starts with an upper case character.
- **Hover:** hover info is incorrect for string literal class names if there are multiple classes with the same final part of the dot separated class name.
- **Completion:** if a text edit triggers a completion in the middle of the expression, selecting a completion is deleting a random # of trailing characters.

## Version 0.12.0 (September 6th, 2021)

### Features

- **GoTo Definition:** add support for handlers and listener methods located in view controller.

## Version 0.11.1 (September 6th, 2021)

### Bug Fixes

- **Parser:** indexing fails on property expressions with inline numeric literal

## Version 0.11.0 (September 6th, 2021)

### Bug Fixes

- **Parser:** improve fail-safe ast parse, receiving non-critical parse exception on trigger char ':'

### Features

- **Completion:** add basic value type completion by default value
- **Completion:** add support for static instance completion

### Refactoring

- **Completion:** remove unnecessary await chain

## Version 0.10.3 (September 5th, 2021)

### Bug Fixes

- **Indexer:** regression - some classapaths are improperly ignored
- **Indexer:** regression - adjust progress indicator when indexing multiple projects

## Version 0.10.2 (September 5th, 2021)

### Bug Fixes

- **Configuration Parser:** package references that have a sencha.modern or sencha.classic object definition in package.json are incorrectly parsed and cause the indexer to fail

## Version 0.10.1 (September 5th, 2021)

### Refactoring

- disable task view, not meant to be enabled yet

## Version 0.10.0 (September 5th, 2021)

### Bug Fixes

- **Logging:** error instances are not properly logged
- **Utils:** isPositionInRange modified
- **Completion:** does not work if first keyword immediately folows a semi-colon
- **Hover:** does not display for properties and configs from extended classes
- **Indexer:** intellisense still works for a non-notified delete of a class file until after vscode restart
- **Indexer:** files modified outside editor while not running are not re-indexed when vscode is started
- **Indexer:** fails to parse full framework path set in vscode settings
- **Indexer:** package reference base directories are added as classpaths without parsing a package.json for the classpaths
- **Validation:** Ext namespace files and package file found in node_modules folder should not be validated
- **Warnings:** duplicate class warning is shown for 2 classes one defined for classic tk and onefor modern
- **Completion:** should not be active behind comments
- **Config Parser:** workspace.json referenced packages are being added as classpath by root, w/o checking package.json sencha.classpath property
- **Config Parser:** invalid json in extjsrc.json file not handled properly
- **Indexer:** when a document is cleared/blanked, it isnot removed from the component cache
- **General:** moving and renaming files causes intellisense for the defined components in the file to stop working until restart
- **Indexer:** fails to parse variables for functions that have keyword names e.g. delete()
- **Indexer:** sencha packages referenced in workspace.json are being added to the project namespace ast cache instead of the Ext namespace ast cache
- **Logging:** indexer command logs method start when finished
- **Indexer:** component ast from the core framework classpath is not loaded from the fs cache on startup in an app.json based project

### Features

- **General:** support intellisense for variables set by up / down / prev / next using itemId
- **General:** support intellisense for variables set by up / down / prev / next
- **Jsdoc:** improve formatting, layout and readability of hover, completion, and signature documentation.

### Refactoring

- **Indexer:** ignore files located in paths underneath a 'test', 'tests', or 'spec' directory.
- **Hover:** instance variables that are separated w/ semi-colon on same line not working

## Version 0.9.1 (September 1st, 2021)

### Bug Fixes

- **Indexer:** if a cached file is removed or renamed, the indexer fails on startup.
- **Indexer:** properties found that are 2 levels deep or more in an object range that is an expression of an assignment are invalidated.

## Version 0.9.0 (September 1st, 2021)

### Bug Fixes

- **General:** if cached component files are modfied while not running, they are not re-indexed on the next initialization
- **Commands:** some internal commands should not show in command pallette
- **Hover:** static/private method does not work
- **Validation:** types within function expressions on the main object are always invalidated
- **Completion:** does not work within call expressions without an assignment
- **Validation:** all types in return objects are invalidated
- **General:** conflicts with task explorer extension
- **Hover:** exception seen in extensions log when hovering on a random string
- **Completion:** selecting the 'string value' item from a value completion list should place the cursor between the quotes

### Documentation

- **Readme:** add additional screenshots to hover section

### Features

- add new command 'dumpCache' for debugging

### Refactoring

- **Validation:** add 'decimal', 'int', and 'list' to list of types that are not validated

## Version 0.8.0 (August 30th, 2021)

### Bug Fixes

- **Parser:** exception seen in log "object key must be a string"
- **General:** references to new/renamed files will not validate in other files
- **Completion:** multi root workspace projects are referencing components in other projects
- **Hover:** if move mouse over a keyword while typing in another and activating completion, an exception is seen in the log
- **Parser:** the main application class that extends Ext.app.Application should use the 'name' property as an alias.
- **Parser:** the main application class that extends Ext.app.Application should use the 'name' property as an alias.
- **Completion:** not working when typing function parameters
- **General:** there should be no processing when the open editor document is not an ExtJs file
- **Hover:** model type not displayed
- **Hover:** type name should always display last part of class name

### Features

- **Completion:** add support for model.create()
- **JsDoc:** add javascript-like type title to hover and completion doc
- **General:** first round implementation of fault tolerance in ast parser
- **Diagnostics:** validation for store 'model' field, cls 'extend' field, and model 'refereces' block
- **Diagnostics:** validation for mixins

### Refactoring

- **Validation:** add 'object' and 'boolean' to default ignored types
- **Parser:** move jsdoc parser to server

### Visuals

- **Indexer:** better status indicator messages

## Version 0.7.2 (August 26th, 2021)

### Bug Fixes

- **Diagnostics:** all 'type' properties with primitive property values being marked invalid.

add a configurable 'ignoreTypes' setting.

## Version 0.7.1 (August 25th, 2021)

### Bug Fixes

- **Config Parser:** extjsrc configuration causes indexing to fail for all projects

## Version 0.7.0 (August 25th, 2021)

### Bug Fixes

- **Validation:** types can sometimes be validated by a class with the same alias name, but different alias namespace
- **Diagnostics:** invalid requires array item does not show suggesstions
- **Parser:** blanking the content of a document throws exception in extensions output channel
- **Validation:** layout types always show invalid type diagnostic

### Features

- full caching system with persistence and in-memory proxy layer

### Performance Enhancements

- load all cached components to server at once as opposed to one by one

### Visuals

- more detailed progress indicator when indexing

## Version 0.6.0 (August 23rd, 2021)

### Bug Fixes

- **Cache:** if an editor is closed within 'vaidationDelay' seconds after editing, changes are not persisted to fs cache
- **Cache:** multiple projects that define xtypes and widgets with same name cause mappings to collide. remove all old mappings in favor of runtime cache filtering.
- **Cache:** if component classes have the same namespace, defined xtypes and/or widgets in different projects in the same workspace, intellisenssnse breaks for those components.
- **Parser:** editing the Ext.define class name causes multiple cache entries to be created, and does not remove the previous class name before having modified it.
- **Parser:** if an ExtJs component definition file is copied and pasted or the entire contents is copied an pasted to another, the cache becomes corrupt.
- **Hover:** methods with parameters on multiple lines show no hover doc
- **Settings:** server logging level description reads 'set client logging level to...'

### Documentation

- **Readme:** add app-publisher plug section

### Features

- **General:** full intellisense for store 'type'
- **Completion:** add support for store type hover
- **Completion:** add support for store object completion by 'type' property.

### Performance Enhancements

- **Cache:** memory cache persists to fs cache only on document save

## Version 0.5.0 (August 21st, 2021)

### Bug Fixes

- **General:** updating the configuration multiple times within a few seconnds can corrupt the runtime cache
- **Completion:** inline does not work behind semi-colon ended statement on same line
- **Indexer:** if a file is modified outside the editor, the intellisense does not update until a ful re-indexing or VSCode restart

### Documentation

- **Readme:** add some jsdoc hover screenshots
- **Readme:** update configuration and jsdoc sections

### Features

- **Completion:** add basic property value completion within xtype defined object blocks
- **Signature:** add support for privates block
- **Completion:** add support for privates block
- **Hover:** reworked jsdoc parsing for better hover docs
- **Signature:** add support for statics
- **Completion:** handle statics

## Version 0.4.5 (August 17th, 2021)

### Refactoring

- add new setting 'toolkit'
- improve logging when reading configurations

### Build System

- fix - tools dir is being included in release package

## Version 0.4.4 (August 17th, 2021)

### Refactoring

- parse all referenced framework dirs, not just the 1st found

### Build System

- update webpack config and packages

## Version 0.4.3 (August 17th, 2021)

### Bug Fixes

- re-index fails for extjs projects found in subfolders of a main VSCode workspace folder

## Version 0.4.2 (August 17th, 2021)

### Bug Fixes

- re-index fails for extjs projects found in subfolders of a main VSCode workspace folder

## Version 0.4.1 (August 17th, 2021)

### Bug Fixes

- build package is including tsc test build

## Version 0.4.0 (August 17th, 2021)

### Bug Fixes

- **Completion:** incorrect jsdoc is sometimes displayed in child cls mid-classpath list
- **Indexer:** re-index command should only re-index  folders in the current workspace, not entire index tree.
- **Completion:** performing an edit inside of an expression and selecting a completion item does not replace the right side part of the expression path
- **Diagnostics:** the 'ensure xtype' command does not uses the quote char set in settings
- **Completion:** if typing in the value of an xtype property, it gets listed in the completion items after the debounce expiration
- **Completion:** typing into string literal value of xtype property does not populate completion
- **Completion:** xtype insertion is invalid if text folowing the text xtype is present, i.e. ':' or ' '
- **Completion:** extended configs and properties are not added when in the main Ext.define object
- **Completion:** xtype properties and configs are not available for parameter reassignments
- **Completion:** xtype intellisense only works when current editor line is below the xtype definition line
- **Completion:** selecting xtype item with text 'xtype' already present outputs 'xtype: xtype: .....'
- **Completion:** item label tags are only sometimes shown
- **Intellisense:** completion fails if property is preceeded by a keyword, e.g. await
- **Validator:** should not validate an extjs file if the project has no app.json or .extjsrc
- **Providers:** the 'goto definitions' does not work for alternate class name strings
- **Validation:** invalid requires block validation error for reference to an alternateClassName or alias

### Documentation

- **Readme:** add section about initial indexing
- **Readme:** update open source projects list

### Features

- **Validation:** add validation for 'uses' component config
- **Indexer:** handle await expression for variables
- **Completion:** mixins parsed and applied to intellisense

### Performance Enhancements

- **Completion:** reduce # of completion items sent to VSCode engine
- **Indexer:** indexing counts reduced while editing
- **Indexer:** async filesystem cache storage

### Refactoring

- **Completion:** add main namespace class aliases to list of preselects
- **Completion:** only show xtype completion when it is not already defined within an object
- **Logging:** improve logging indentation and levels output

### Build System

- **GitHub Release:** fix - vsix fails to upload with guthub release

## Version 0.3.1 (August 12th, 2021)

### Bug Fixes

- **Providers:** occassionally the 'got to definition' provider just jumps to the top of the current file
- **AST Parser:** static properties are not correctly parsed
- **Providers:** goto type definition for an Ext framework component does not work from a string literal
- **Logging:** the indentation in the logging is incorrect on hover
- **Logging:** logged values are not aligned in some places
- **Providers:** type definition provider for instance property within a method throws unhandled exception
- **AST Parser:** the alternateClassName property is not parsed correctly when it doesn't contain the string '.widget'.

### Refactoring

- **Cache:** change cache mechanism to separate workspace projects
- **AST Parser:** add parsing for 'type' store alias
- **Providers:** validate class that begin with Ext. but are not core framework

## Version 0.3.0 (August 8th, 2021)

### Bug Fixes

- **Hover Provider:** diagnostic quick fix window provided by other extensions is inaccessible due to being overridden by jsdoc hover

### Features

- **Intellisense:** add object property/config intellisense
- **Validation:** add requires array validation

## Version 0.2.1 (August 8th, 2021)

### Bug Fixes

- **Hover Provider:** throws 'Cannot read property nameSpace of undefined' exception in non-ExtJs JavaScript files.

### Documentation

- **Readme:** update todos

## Version 0.2.0 (August 7th, 2021)

### Bug Fixes

- the 'fix requires' quick fix doesn't work if there's no existing requires block
- intellisense should be disabled in strings and comments

### Features

- add 'ignore' options for diagnostic quick fixes

## Version 0.1.1 (August 4th, 2021)

### Documentation

- **Readme:** content update

### Visuals

- update marketplace icon

## Version 0.1.0 (August 3rd, 2021)

### Bug Fixes

- class mappings wrong if 2+ projects define the same alternate class name

### Performance Enhancements

- file system watchers watch only configured classpaths, as opposed to entire workspace directory

### Refactoring

- prompt before re-indexing project when app.json or other config file changes

## Version 0.16.0 (August 1st, 2021)

- initial release
