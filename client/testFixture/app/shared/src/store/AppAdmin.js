
Ext.define('VSCodeExtJS.store.AppAdmin', 
{
    extend: 'Ext.data.Store',
    alias: 'store.appadmin', 
    
    model: 'GEMS.model.ApplicationConfiguration',
    table: 'application_configuration'
        
});

