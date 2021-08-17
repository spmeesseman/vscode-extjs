
Ext.define('VSCodeExtJS.store.user.Users', 
{
    extend: 'Ext.data.Store',
    alias: 'store.users',
    model: 'VSCodeExtJS.model.user.User',
    table: 'usermaster',
    
    sorters: [ 
    {
        property: 'userid',
        direction: 'ASC'
    }],
    
    ignore: [
    {
        property: 'password'
    }],
        
    innerJoin: [
    {
        property: 'address',
        table: 'address',
        idProperty: 'id',
        foreignKey: 'userid',
        column: 'email',
        additionalKeys: [
        {
            property: 'type',
            value: 0
        }]
    }],

    nestReport: [
    {
        property: 'address',
        table: 'address',
        idProperty: 'id',
        foreignKey: 'userid',
        column: 'email'
    },
    {
        property: 'department',
        table: 'department',    
        idProperty: 'id',
        foreignKey: 'deptid'
    }]
});
