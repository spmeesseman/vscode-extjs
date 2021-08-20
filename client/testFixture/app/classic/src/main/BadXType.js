/**
 * @class VSCodeExtJS.main.BadRequire
 * 
 * The VSCodeExtJS.main.BadRequire namespace.
 * 
 * For testing invalid requires array
 */
 Ext.define('VSCodeExtJS.main.BadXType', {

    extend: 'Ext.Container',

    requires: [
        "VSCodeExtJS.common.PhysicianDropdown"
    ],

    items: [
    {
        xtype: "comboisnotanywhere"
    }]

});
