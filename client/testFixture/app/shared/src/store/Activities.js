
Ext.define('VSCodeExtJS.store.Activities', 
{
    extend: 'Ext.data.Store',
    alias: 'store.activities',
    
    model: 'VSCodeExtJS.model.Activity',
    table: 'activity',
    
    sorters: [ 
    {
        property: 'name',
        direction: 'ASC'
    }]

});
