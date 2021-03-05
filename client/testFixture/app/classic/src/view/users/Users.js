Ext.define('VSCodeExtJS.view.users.Users', 
{
    extend: 'Ext.tab.Panel',
    xtype: 'users',
    
    requires: [
        'VSCodeExtJS..view.users.Grid'
    ],

    border:false,
    iconCls: "fa fa-users",
    
    layout: 
    {
        type: 'card',
        align: 'stretch',
        pack: 'start'
    },
    
    defaults:
    {
        closable: false,
        flex: 1,
        iconCls: "fa fa-list"
    },

    items: [
    {
        xtype: 'usersgrid',
        title: 'VSCodeExtJS Users'
    }]
    
});
