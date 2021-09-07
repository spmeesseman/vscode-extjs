/**
 * @class VSCodeExtJS.view.users.Grid
 * 
 * Displays all users
 */
Ext.define('VSCodeExtJS.view.users.Grid', 
{
    extend: 'Ext.grid.Panel',
    xtype: 'usersgrid',
    
    requires: [
    ],

    controller: 'usersgrid',
    
    autoLoad: true,
    autoScroll: true,
    layout: 'fit',

    viewModel:
    {
        data: 
        {
            fromView: ''
        },
        
        formulas: 
        {
            sayHi: function(get) 
            {
                // do something
            }
        },
        
        stores:
        {
            users:
            {
                type: 'users',
                paged: true
            }
        }
    },
    
    randomFn: function()
    {
        console.log(random);
        this.setDisabled(true);
        this.setHidden(true);
    },

    bind: {
        store: '{users}'
    },

    listeners:
    {
        /**
         * @param {Ext.grid.Panel} grid 
         */
        render: function(grid)
        {
            grid.getController().sayHi();
        },
        afterrender: 'onAfterRender'
    },
    
    dockedItems: [
    {
        xtype: 'toolbar',
        items: [{
            text: 'OK',
            handler: 'onOkClick'
        }]
    },
    {
        xtype: 'pagingtoolbar',
        dock: 'bottom',
        displayInfo: true,
        flex: 1,
        bind:
        {
            store: '{users}'
        }
    }],

    columns: [
    {
        text: 'User ID', 
        dataIndex: 'userid', 
        filter: 'string',
        minWidth: 90,
        flex: 0.8 
    },
    {
        text: 'Session ID', 
        dataIndex: 'sessionid', 
        minWidth: 150,
        flex: 1
    },
    {
        text: 'Last Activity',           
        dataIndex: 'dtactivity',     
        width: 150,    
        minWidth: 100,
        xtype : 'datecolumn',
        filter: 'date',
        exportRenderer: true,
        renderer: AppUtils.formatDateAndTime
    }]
    
});
