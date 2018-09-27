// override to use our description popover
Ext.override(Rally.ui.popover.PopoverFactory,{
    bake: function(options) {
        if (!options.record || (options.record && options.record.isSearch())) {
            var type = options.type || options.record.data._type;
            var oid = options.oid || options.record.get('ObjectID');
            var bakingId = this._lastRequestedAsyncBakeId = new Date().getTime();
            Rally.data.ModelFactory.getModel({
                type: type,
                success: function(model) {
                    model.load(oid, {
                        success: function(record) {
                            if(bakingId === this._lastRequestedAsyncBakeId) {
                                this._onRecordLoad(record, options);
                            }
                        },
                        scope: this
                    });
                },
                scope: this
            });
        } else {
            return this._onRecordLoad(options.record, options);
        }
    },

    _onRecordLoad: function(record, options){
        if ( options.field == "Description" ) {
            options.record = record;
            return Ext.create('CArABU.technicalservices.DescriptionPopover', Ext.merge({
                context: {
                    workspace: options.record.get('Workspace')._ref,
                    project: null
                }
            }, options));
        }

        if (this.popovers[options.field]) {
            options.record = record;
            return this.popovers[options.field](options);
        }
    }
});

//
Ext.override(Rally.ui.description.DescriptionRichTextView,{

    _createStore: function() {
        var model = this.storeConfig.model;

        return Ext.create('Rally.data.wsapi.Store', Ext.apply({
            fetch: ['Name', 'FormattedID', 'TargetProject', this.detailsField],
            limit: 1,
            pageSize: 1,
            autoLoad: true,
            requester: this
        }, this.storeConfig));
    },

    _setDetailsField: function() {
        return "Description";
    }

});


// milestone doesn't have a "project" field
Ext.define('CArABU.technicalservices.DescriptionPopover',{
    alias: 'widget.tsdescriptionpopover',
    extend: 'Rally.ui.popover.HoverablePopover',
    requires: ['Rally.ui.description.DescriptionRichTextView'],

    id: 'description-popover',
    cls: 'description-popover',

    constructor: function(config) {
        var recordProject = config.record.get('Project');
        config.items = [
            {
                xtype: 'rallydescriptionrichtextview',
                context: config.context,
                listeners: {
                    scope: this,
                    viewready: function() {
                        if (Rally.BrowserTest) {
                            Rally.BrowserTest.publishComponentReady(this);
                        }
                    }
                },
                storeConfig: {
                    context: null,
                    filters: [{ property: 'ObjectID', operation: '=', value: config.record.get('ObjectID') }],
                    model: config.record.get('_type')
                }
            }
        ];
        this.callParent(arguments);
    }
});
