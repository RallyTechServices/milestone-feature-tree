Ext.define("CArABU.app.MilestoneFeatureTree", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new CArABU.technicalservices.Logger(),
    defaults: { margin: 10 },

    items: [
        {xtype:'container',flex: 1, itemId:'header', minHeight: 100},
        {xtype:'container',flex: 1, itemId:'display_box'}
    ],

    milestoneStore: null,
    milestoneTreeStore: null,

    integrationHeaders : {
        name : "CArABU.app.MilestoneFeatureTree"
    },

    launch: function() {
        this.logger.setSaveForLater(this.getSetting('saveLog'));
        this._fetchModels().then({
            scope: this,
            success:function(models){
                this.models = models;
                this.logger.log("Models: ", models);
                this._addTree();
            },
            failure: function(msg) {
                alert(msg);
            }
        });
    },

    _addTree: function() {
        var container = this.down('#display_box');
        container.removeAll();

        var available_height = this._getAvailableTreeHeight();
        this.logger.log('Height: ', available_height);

        container.add({
            xtype:'tsmilestonetree',
            columns: this._getColumns(),
            targetType: 'Milestone',
            height: available_height,
            maxHeight: available_height,
            logger: this.logger,
            respectScopeForChildren: true
        });
    },

    //
    _getAvailableTreeHeight: function() {
        var body_height = this.getHeight() || Ext.getBody().getHeight() || 0;
        var available_height = body_height - 100;
        return Ext.max([200,available_height]);
    },

    _getColumns: function() {
        var me = this;
        var name_renderer = function(value,meta_data,record) {
            return me._nameRenderer(value,meta_data,record);
        };

        var magic_renderer = function(field,value,meta_data,record){
            return me._magicRenderer(field,value,meta_data,record);
        }

        var columns = [
            {
                xtype: 'treecolumn',
                text: 'Item',
                dataIndex: 'Name',
                itemId: 'tree_column',
                renderer: name_renderer,
                minWidth: 400,
                menuDisabled: true,
                otherFields: ['FormattedID','ObjectID']
            },
            /*{
                text:'Project',
                dataIndex:'Project',
                menuDisabled: true,
                renderer:function(value,meta_data,record){
                    return me._magicRenderer({name:'Project'},value,meta_data,record) || "";
                }
            },*/
            {
                text:'Target Date',
                dataIndex: 'TargetDate',
                renderer: function(value,meta_data,record) {
                    return me._magicRenderer({name:'TargetDate'},value,meta_data,record) || "";
                }
            },
            {
                text:'Owner',
                dataIndex: 'Owner',
                renderer: function(value,meta_data,record) {
                    return me._magicRenderer({name:'Owner'},value,meta_data,record) || "";
                }
            },
            {
                text:'Leaf Story Count',
                dataIndex:'LeafStoryCount',
                menuDisabled: true,
                hidden: true,
                calculator: function(item) {
                    return val = item.get('LeafStoryCount') || 0;
                }
            },
            {
                text: 'Accepted Leaf Story Count',
                dataIndex: 'AcceptedLeafStoryCount',
                hidden: true,
                menuDisabled: true,
                calculator: function(item) {
                    return val = item.get('AcceptedLeafStoryCount') || 0;
                }
            },
            {
                text: 'Percent Done By Story Count',
                dataIndex: 'PercentDoneByStoryCount',
                menuDisabled: true,
                renderer: function(value,meta_data,record){
                    return me._magicRenderer({name:'PercentDoneByStoryCount'},value,meta_data,record) || "";
                },
                // use convert because it's not a rollup
                convert: function(value,item) {
                    var partial = item.get('AcceptedLeafStoryCount') || 0;
                    var total = item.get('LeafStoryCount') || 0;
                    var result = 0;
                    if ( total !== 0 ) {
                        result = partial/total;
                    }
                    return Ext.Number.toFixed(result,2);
                }
            },
            {
                text:'Leaf Story Plan Estimate Total',
                dataIndex:'LeafStoryPlanEstimateTotal',
                menuDisabled: true,
                hidden: true,
                calculator: function(item) {
                    return val = item.get('LeafStoryPlanEstimateTotal') || 0;
                }
            },
            {
                text: 'Accepted Leaf Plan Estimate Total',
                dataIndex: 'AcceptedLeafStoryPlanEstimateTotal',
                hidden: true,
                menuDisabled: true,
                calculator: function(item) {
                    return val = item.get('AcceptedLeafStoryPlanEstimateTotal') || 0;
                }
            },
            {
                text: 'Percent Done By Story Plan Estimate',
                dataIndex: 'PercentDoneByStoryPlanEstimate',
                menuDisabled: true,
                renderer: function(value,meta_data,record){
                    return me._magicRenderer({name:'PercentDoneByStoryPlanEstimate'},value,meta_data,record) || "";
                },
                // use convert because it's not a rollup
                convert: function(value,item) {
                    var partial = item.get('AcceptedLeafStoryPlanEstimateTotal') || 0;
                    var total = item.get('LeafStoryPlanEstimateTotal') || 0;

                    var result = 0;
                    if ( total !== 0 ) {
                        result = partial/total;
                    }
                    return Ext.Number.toFixed(result,2);
                }
            }
        ];

        if ( this.additional_columns ) {
            this.logger.log("Additional fields: ", this.additional_columns);
            Ext.Array.each(this.additional_columns, function(field) {
                columns.push({
                    text:field.get('displayName').replace(/\(.*\)/,""),
                    dataIndex:field.get('name'),
                    menuDisabled: true,
                    renderer:function(value,meta_data,record){
                        return me._magicRenderer(field,value,meta_data,record) || "";
                    }
                });
            });
        }
        return columns;
    },
    _nameRenderer: function(value,meta_data,record) {
        var display_value = record.get('Name');
        if ( record.get('FormattedID') ) {
            var link_text = record.get('FormattedID') + ": " + value;
            var url = Rally.nav.Manager.getDetailUrl( record );
            display_value = "<a target='_blank' href='" + url + "'>" + link_text + "</a>";
        }
        return display_value;
    },
    _magicRenderer: function(field,value,meta_data,record){
        var field_name = field.name || field.get('name');
        var record_type = record.get('_type');
        var model = this.models[record_type];
        // will fail if field is not on the record
        // (e.g., we pick accepted date, we are also showing features
        try {
            var field = model.getField(field_name);

            if ( !field ) {
                Ext.Object.each(this.models, function(key,value){
                    field = value.getField(field_name);
                    if ( field ) { return false; }
                });
            }
            var template = Rally.ui.renderer.RendererFactory.getRenderTemplate(field);
            return template.apply(record.data);
        } catch(e) {
            console.log(e);
            return ".";
        }
    },

    _fetchModels: function(){
        var deferred = Ext.create('Deft.Deferred');

        TSUtilities.fetchPortfolioNames().then({
            scope: this,
            success:function(pi_names){
                var model_names = Ext.Array.merge(['milestone','hierarchicalrequirement'],pi_names);
                Rally.data.ModelFactory.getModels({
                    types: model_names,
                    success: function(model_hash) {
                        deferred.resolve(model_hash);
                    },
                    failure: deferred.reject
                });
            },
            failure:deferred.reject
        });
        return deferred.promise;
    },

    _temp: function() {
        if ( ! this.milestoneStore ) {
            this.milestoneStore = Ext.create('Rally.data.wsapi.Store',{
                model: 'Milestone',
                listeners: {
                    scope: this,
                    load: function(store,milestones) {
                        var filters = [];
                        Ext.Array.each(milestones, function(milestone){
                            //if ( record.get(TotalArtifactCount) > 0) {
                                filters.push({
                                    property: "Milestones.ObjectID",
                                    operator: "=",
                                    value: milestone.get('ObjectID')
                                });
                            //}
                        });

                        if ( filters.length === 0 ) {
                            console.log('No Milestones with items');
                        } else {
                            console.log("Found " + milestones.length + " milestones");
                            var config = {
                                model: 'PortfolioItem/Feature',
                                fetch: ['Name','State','Milestones'],
                                filters: Rally.data.wsapi.Filter.or(filters)
                            };
                            TSUtilities.loadWsapiRecords(config).then({
                                success: function(features) {
                                    var store = me._updateTree(milestones,features);
                                },
                                failure: function(msg) {
                                    Ext.Msg.show({
                                        msg: msg
                                    });
                                }
                            }).always(function(){ me.setLoading(false);});
                        }
                    }
                }
            });
        }

        this.milestoneStore.load();
    },

    /*
     * TODO: move to a model for milestones
     */
    _updateMilestoneCalculations: function(milestone){
        milestone.set('__filteredChildCount',0);
        milestone.set('__filteredChildEstimate',0);
        Ext.Array.each(milestone.get('children') || [], function(child){
            milestone.set('__filteredChildCount', milestone.get('__filteredChildCount') + 1);
        });
        return milestone;
    },

    _updateTree: function(milestones,features) {
        Rally.getApp() && Rally.getApp().setLoading('Calculating...');
        var milestonesByID = {};
        Ext.Array.each(milestones, function(milestone){
            milestone.set('children',[]);
            milestonesByID[milestone.get('ObjectID')] = milestone;
        });
        Ext.Array.each(features, function(feature){
            if ( feature.get('Milestones')) {
                var tagArray = feature.get('Milestones')._tagsNameArray;
                Ext.Array.each(tagArray, function(tag){
                    var oid = parseInt(tag._ref.replace(/.*\//,''), 10);
                    if ( milestonesByID[oid] ) {
                        var featureArray = milestonesByID[oid].get('children');
                        featureArray.push(feature);
                        milestonesByID[oid].set('children',featureArray);
                    }
                });
            }
        });

        Ext.Array.each(milestones, function(milestone){
            milestone = this._updateMilestoneCalculations(milestone);
        },this);

        var store = Ext.create('Ext.data.TreeStore',{
            root: { "children": milestones },
            proxy: {
                type: "memory"
            }
        });
        return milestones;
    },

    todo: function() {
        Deft.Chain.sequence([
            function() {
                return TSUtilities.loadAStoreWithAPromise('Defect',['Name','State']);
            },
            function() {
                return TSUtilities.loadWsapiRecords({
                    model:'Defect',
                    fetch: ['Name','State']
                });
            }
        ]).then({
            scope: this,
            success: function(results) {
                var store = results[0];
                var defects = results[1];
                var field_names = ['Name','State'];

                this._displayGridGivenStore(store,field_names);
                this._displayGridGivenRecords(defects,field_names);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },

    _displayGridGivenStore: function(store,field_names){
        this.down('#grid_box1').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    },

    _displayGridGivenRecords: function(records,field_names){
        var store = Ext.create('Rally.data.custom.Store',{
            data: records
        });

        var cols = Ext.Array.map(field_names, function(name){
            return { dataIndex: name, text: name, flex: 1 };
        });
        this.down('#grid_box2').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: cols
        });
    },

    getSettingsFields: function() {
        var check_box_margins = '5 0 5 0';
        return [{
            name: 'saveLog',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: '',
            margin: check_box_margins,
            boxLabel: 'Save Logging<br/><span style="color:#999999;"><i>Save last 100 lines of log for debugging.</i></span>'

        }];
    },

    getOptions: function() {
        var options = [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];

        return options;
    },

    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }

        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{
            showLog: this.getSetting('saveLog'),
            logger: this.logger
        });
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }

});
