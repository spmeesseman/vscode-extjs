
Ext.define('VSCodeExtJS.model.User', 
{
    extend: 'Ext.data.Model',
    alias: 'model.user',
    alternateClassName: 'VSCodeExtJS.model.user.User',
    
    table: 'users', 

    fields: [
    {
        name : 'id',
        type : 'number'
    },
    {
        name : 'userid',
        type : 'string'
    },
    {
        name : 'password'
    },
    {
        name : 'dtexpires',
        type : 'date',
        dateFormat: 'm/d/Y H:i:s'
    }]

});
