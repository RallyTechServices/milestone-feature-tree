Ext.define("CArABU.app.MilestoneFeatureTree", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new CArABU.technicalservices.Logger(),
    defaults: { margin: 10 },

    items: [
        {xtype:'container', itemId:'header', minHeight: 30},
        {xtype:'container', itemId:'filter_container'},
        {xtype:'container', itemId:'display_box'}
    ],

    // targetFilter is the filter for the top-level item(s)
    targetFilter: null,

    integrationHeaders : {
        name : "CArABU.app.MilestoneFeatureTree"
    },

    launch: function() {
        this.logger.setSaveForLater(this.getSetting('saveLog'));
        this._fetchModels().then({
            scope: this,
            success:function(models){
                this.models = models;
                this._addControls();
            },
            failure: function(msg) {
                alert(msg);
            }
        });

    },

    _addControls: function() {
        var container = this.down('#header')

        container.add(this._getFilterPickerConfig());
        container.add(this._getColumnPickerConfig());
    },

    _getColumnPickerConfig: function() {
        return {
            xtype:'tsfieldpickerbutton',
            modelNames: ['milestone','portfolioitem'],
            fieldBlackList: ['Changesets','Connections','Collaborators',
                'Description','Notes','ObjectID','ObjectUUID','RevisionHistory',
                'Risks','Subscription','VersionId','Workspace'],
            context: this.getContext(),
            stateful: true,
            stateId: this.getContext().getScopedStateId('fieldpicker'),
            alwaysSelectedValues: ['FormattedID', 'Name', 'PercentDoneByStoryPlanEstimate', 'PercentDoneByStoryCount'],
            listeners: {
                fieldsupdated: function(fields){
                    console.log('fields',fields);
                    this._addTree();
                },
                afterrender: this._addTree,
                scope: this
            }
        };
    },

    _getFilterPickerConfig: function() {
        var blackListFields = ['FlowState'],
            whiteListFields = ['Tags'];
        return {
            xtype: 'rallyinlinefiltercontrol',
            align: 'left',
            inlineFilterButtonConfig: {
                stateful: true,
                stateId: this.getContext().getScopedStateId('ms-inline-filter'),
                context: this.getContext(),
                modelNames: ['milestone'],
                filterChildren: false,
                inlineFilterPanelConfig: {
                    quickFilterPanelConfig: {
                        defaultFields: ['ArtifactSearch'],
                        addQuickFilterConfig: {
                            blackListFields: blackListFields,
                            whiteListFields: whiteListFields
                        }
                    },
                    advancedFilterPanelConfig: {
                        advancedFilterRowsConfig: {
                            propertyFieldConfig: {
                                blackListFields: blackListFields,
                                whiteListFields: whiteListFields
                            }
                        }
                    }
                },
                listeners: {
                    inlinefilterchange: this._onFilterChange,
                    inlinefilterready: function (inlineFilterPanel) {
                      this.down('#filter_container').add(inlineFilterPanel);
                    },
                    scope: this
                }
            }
        };
    },

    _onFilterChange: function(inlineFilterButton) {
        this.logger.log('--',inlineFilterButton.getTypesAndFilters());
        var typesandfilters = inlineFilterButton.getTypesAndFilters();

        this.targetFilter = typesandfilters && typesandfilters.filters;
        if ( this.targetFilter.length === 0 ) {
            this.targetFilter = null;
        } else {
            this.targetFilter = this.targetFilter[0];
        }

        this._addTree();
    },

    _addTree: function() {
        var container = this.down('#display_box');
        container.removeAll();

        this.setLoading("Loading...");

        var available_height = this._getAvailableTreeHeight();
        this.logger.log('Height: ', available_height);
        var tree_config = {
            xtype:'tsmilestonetree',
            columns: this._getColumns(),
            targetType: 'Milestone',
            height: available_height,
            maxHeight: available_height,
            logger: this.logger,
            respectScopeForChildren: true,
            listeners: {
                scope: this,
                afterrender: function() {
                    this.setLoading("Loading tree...");
                },
                afterloadtargets: function(tree,items) {
                    this.setLoading("Finding children (" + items.length + ")");
                },
                aftertree: function() {
                    this.setLoading(false);
                }
            }
        };
        if ( this.targetFilter ) {
            tree_config.targetFilter = this.targetFilter;
        }
        container.add(tree_config);
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
                flex: 1,
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

        var fieldpicker = this.down('tsfieldpickerbutton');

        var additional_fields = fieldpicker && fieldpicker.getFields();
        if ( additional_fields ) {
            this.logger.log("Additional fields: ", additional_fields);
            var blackListFields = ['FormattedID','Name','PercentDoneByStoryPlanEstimate','PercentDoneByStoryCount'];

            Ext.Array.each(additional_fields, function(field_name) {

                if ( Ext.Array.contains(blackListFields,field_name) ) {
                    return;
                }
                var field = null;
                Ext.Object.each(me.models, function(key,model){
                    field = model.getField(field_name);
                    console.log(key,field_name);
                    if ( field ) { return false; }
                });

                if ( !field ) { console.log('cannot find field ', field_name); }

                columns.push({
                    text:field.displayName.replace(/\(.*\)/,""),
                    dataIndex:field.name,
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
                var model_names = Ext.Array.merge(pi_names,['milestone','hierarchicalrequirement']);
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
