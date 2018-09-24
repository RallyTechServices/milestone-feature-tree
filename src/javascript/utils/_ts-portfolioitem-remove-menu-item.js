Ext.define('CArABU.technicalservices.RemoveMenuItem', {
    alias:'widget.tsrecordmenuitemremove',
    extend:'Rally.ui.menu.item.RecordMenuItem',
    requires: [
        'Rally.nav.Manager',
        'Rally.ui.detail.DetailHelper'
    ],

    config:{
        predicate: function(record) {
            return record.isUpdatable();
        },

        handler: function() {
            var tree_item = this.record;
            if ( tree_item.get('__parent') ) {
                var store = this.view.getStore();
                var milestone_oid_to_be_removed = tree_item.get('__parent');
                var index = store.find( 'ObjectID', milestone_oid_to_be_removed);
                var milestone_in_tree = store.getAt(index);
                var children = milestone_in_tree.get('children');
                var filtered_children = Ext.Array.filter(children, function(child){
                    return ( child.ObjectID != tree_item.get('ObjectID') );
                });
                milestone_in_tree.set('children',filtered_children);
                store.remove([tree_item]);

                //in this tree, the pi item isn't exactly a wsapi data model item, so we have to reload it to remove it
                TSUtilities.loadWsapiRecords({
                    filters: [{property:'ObjectID',value:tree_item.get('ObjectID')}],
                    model: 'PortfolioItem',
                    limit: 1,
                    pageSize: 1
                }).then({
                    success: function(results){
                        var item = results[0];
                        var remove_array = [{ '_ref': '/milestone/' + milestone_oid_to_be_removed}];
                        var ms = item.getCollection('Milestones');
                        ms.load({
                            scope: this,
                            callback: function(records, operation, success) {
                                ms.remove(remove_array);
                                ms.sync({
                                    callback: function() {
                                    }
                                });
                            }
                        });

                    },
                    failure: function(err) {
                        alert(err);
                    }
                });
            }
        },

        text: 'Remove...'
    }
});
