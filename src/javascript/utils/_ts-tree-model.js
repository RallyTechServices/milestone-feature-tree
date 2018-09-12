Ext.define('TSTreeModel',{
    extend: 'Ext.data.Model',
    fields: [
        { name: 'FormattedID', type: 'String' },
        { name: 'Name', type:'String' },
        { name: '_ref', type:'String' },
        { name: '_type', type:'String' }
    ]
});
