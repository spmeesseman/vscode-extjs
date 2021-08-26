# VSCODE-EXTJS CHANGE LOG

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
