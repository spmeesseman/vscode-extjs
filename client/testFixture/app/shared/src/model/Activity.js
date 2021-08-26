
Ext.define('VSCodeExtJS.model.Activity', 
{
    extend: 'Ext.data.Model',
    alias: 'model.activity',
    
    table: 'activity_action',
    
    requires: [
        'VSCodeExtJS.model.user.User'
    ],
        
    fields: [
    { 
        name: 'activity',  
        type: 'string',
        reference:
        {
            type: 'User',
            role: 'user',
            inverse: 
            {
                role: 'activity',
                storeConfig:
                {
                    type: 'activities'
                }
            }
        }
    },
    { 
        name: 'action',    
        type: 'string' 
    },
    { 
        name: 'displayAction',    
        type: 'string',
        persist: false
    },
    { 
        name: 'selected',    
        type: 'boolean',
        defaultValue: false,
        persist: false
    }]

});
