Ext.define('CArABU.technicalservices.FieldEditMenuItem', {
    alias:'widget.tsrecordmenuitemfieldedit',
    extend:'Rally.ui.menu.item.RecordMenuItem',

    config:{
        predicate: function(record) {
            return record.isUpdatable();
        },

        rally_items: [],

        handler: function() {
            var tree_item = this.record;
            TSUtilities.loadWsapiRecords({
                filters: [{property:'ObjectID',value:tree_item.get('ObjectID')}],
                model: tree_item.get('_type')
            }).then({
                scope: this,
                success: function(results){
                    this.rally_items = results;
                    //Ext.create(this.self.bulkierEditEnabled() ? 'Rally.ui.dialog.BulkierEditDialog' : 'Rally.ui.dialog.BulkEditDialog', {
                    Ext.create('Rally.ui.dialog.BulkEditDialog', {
                        records: this.rally_items,
                        title: 'Field Edit',
                        listeners: {
                            edit: this._onEdit,
                            scope: this
                        }
                    });
                },
                failure: function(err) {
                    alert(err);
                }
            });
        },

        text: 'Edit field...'
    },

    _onEdit: function(dialog, args) {
        this.saveRecords(this.rally_items, args);
    },

    prepareRecords: function(rally_records, args) {
        var successfulRecords = [];

        _.each(rally_records, function (rally_record) {
            rally_record.beginEdit();

            this._setValue(rally_record, args.field.name, args.value);

            if (Ext.Object.getSize(rally_record.getChanges()) === 0) {
                successfulRecords.push(rally_record);
                rally_record.cancelEdit();
            }
        }, this);

        return successfulRecords;
    },

    _setValue: function(rally_record, field, value) {
        rally_record.set(field, value);
        if ( _.isDate(value) ) {
            value = moment(value).format('YYYY-MM-DD');
        }
        this.record.set(field,value);

        if(!rally_record.getChanges().hasOwnProperty(field)) {
            rally_record.modified[field] = value;
            rally_record.dirty = true;
        }
    },

    saveRecords: function(records,args) {
        var me = this,
            successfulRecords = this.prepareRecords(records, args);

        if (successfulRecords.length === records.length) {
            //me.onSuccess(successfulRecords, [], args);
        } else {
            Ext.create('Rally.data.wsapi.batch.Store', {
                requester: this,
                data: _.difference(records, successfulRecords)
            }).sync({
                callback: function(batchOptions) {
                    var resultSet = batchOptions.operations[0].resultSet;
                    successfulRecords = successfulRecords.concat(_.filter(records, function(record) {
                        return _.any(resultSet.records, function(r) {
                            return r.get('_ref') === record.get('_ref');
                        });
                    }));

                    var unsuccessfulRecords = _.difference(records, successfulRecords);
                    if(successfulRecords.length) {
                        //me.onSuccess(successfulRecords, unsuccessfulRecords, args, resultSet.message);
                    } else {
                        Rally.ui.notify.Notifier.showError({
                            message: resultSet.message
                        });
                        Ext.callback(me.onActionComplete, null, [successfulRecords, unsuccessfulRecords]);
                    }
                }
            });
        }
    }
});
