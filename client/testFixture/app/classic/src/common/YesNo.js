/**
 * @class VSCodeExtJS.common.YesNo
 *
 * Pre-configured grid filter using a Yes/No enumaration, with configurable values
 * 
 */
Ext.define('VSCodeExtJS.common.YesNo', 
{
    extend: 'Ext.grid.filters.filter.Boolean',
    alias: 'grid.filter.yesno',

    constructor: function(config) 
    {
        var me = this;

        me.callParent([config]);

        me.type = 'yesno';
        me.yesValue = 'Y';
        me.noValue = 'N';
    }

});
