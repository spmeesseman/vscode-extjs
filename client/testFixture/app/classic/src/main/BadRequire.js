/**
 * @class VSCodeExtJS.main.BadRequire
 * 
 * The VSCodeExtJS.main.BadRequire namespace.
 * 
 * For testing invalid requires array
 */
Ext.define('VSCodeExtJS.main.BadRequire', {

    extend: 'Ext.panel.Panel',

    requires: [
        "VSCodeExtJS.common.PhysicanDropdown",
        "Ext.frm.field.ComboBox"
    ],

    /**
     * @property prop1
     * Test property #1
     */
    prop1: true,

    config: {
        /**
         * @cfg cfg1
         * Config property #1
         */
        cfg1: true,
    },

    items: [
    {
        xtype: "combo"
    },
    {
        xtype: 'physiciandropdown'
    }]

});
