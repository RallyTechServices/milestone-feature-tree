Ext.define("CArABU.app.MilestoneFeatureTree", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new CArABU.technicalservices.Logger(),
    defaults: { margin: 10 },

    stateful: true,
    stateId: 'ts-milestone-featuretree',
    stateEvents: ['columnschanged'],

    items: [
        {xtype:'container', itemId:'header', minHeight: 30 , layout: 'hbox', items: [
            {xtype:'container',itemId:'filter_box'},
            {xtype:'container',itemId:'column_box'},
            {xtype:'container',itemId:'view_box'},
            {xtype:'container',itemId:'limit_box', margin: '0 0 0 15'}
        ]},
        {xtype:'container', itemId:'filter_container'},
        {xtype:'container', itemId:'display_box'}
    ],

    // targetFilter is the filter for the top-level item(s)
    targetFilter: null,
    filterConfig: null,

    integrationHeaders : {
        name : "CArABU.app.MilestoneFeatureTree"
    },

    launch: function() {
        this.logger.setSaveForLater(this.getSetting('saveLog'));
        this._fetchModels().then({
            scope: this,
            success:function(models){
                this.models = models;
                this.logger.log('models:',models);
                this._addControls();
            },
            failure: function(msg) {
                alert(msg);
            }
        });

    },

    _addControls: function() {
        var container = this.down('#header')
        container.down('#limit_box').add(this._getCheckboxConfig());
        container.down('#filter_box').add(this._getFilterPickerConfig());
        container.down('#column_box').add(this._getColumnPickerConfig());
        container.down('#view_box').add(this._getViewComboConfig());
    },

    _getCheckboxConfig: function() {
        var config = {
            xtype:'rallycheckboxfield',
            itemId: 'limitToInScopeFeatures_cb',
            boxLabel: 'Limit to Milestones with in-scope Features',
            hideLabel: true,
            value: true,
            listeners: {
                scope: this,
                change: this._addTree
            }
        };
        return config;
    },

    _getViewComboConfig: function() {
        var config = {
            xtype:'tssharedviewcombobox',
            context: this.getContext(),
            margin: '2 0 0 10',
            cmp: this
        };
        return config;
    },

    _getColumnPickerConfig: function() {
        return {
            xtype:'tsfieldpickerbutton',
            modelNames: ['milestone','portfolioitem'],
            fieldBlackList: ['Changesets','Connections','Collaborators',
                'Description','Notes','ObjectID','ObjectUUID','RevisionHistory',
                'Risks','Subscription','VersionId','Workspace','DragAndDropRank',
                'Rank','Artifacts','DisplayColor'
            ],
            context: this.getContext(),
            stateful: true,
            stateId: this.getContext().getScopedStateId('fieldpicker'),
            alwaysSelectedValues: ['FormattedID','Name'],
            listeners: {
                fieldsupdated: function(fields){
                    var background_field_names = ['_type','_ObjectID'];
                    if ( this.saved_columns ) {
                        this.saved_columns = Ext.Array.filter(this.saved_columns, function(col){
                            return ( Ext.Array.contains(background_field_names,col.dataIndex) || Ext.Array.contains(fields,col.dataIndex));
                        });
                    }
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
        var config = {
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
        if ( this.filterConfig ) {
            config.inlineFilterButtonConfig.inlineFilterPanelConfig = Ext.apply(config.inlineFilterButtonConfig.inlineFilterPanelConfig, this.filterConfig);
        }

        return config;
    },

    _onFilterChange: function(inlineFilterButton) {
        this.logger.log('filter changed:',inlineFilterButton.getTypesAndFilters());
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
        this.logger.log("Ready to add tree");
        var container = this.down('#display_box');
        container.removeAll();

        this.setLoading("Loading...");

        var available_height = this._getAvailableTreeHeight();
        var available_width = this._getAvailableTreeWidth();

        var context = this.getContext();

        var tree_config = {
            xtype:'tsmilestonetree',
            columns: this._getColumns(),
            context: context,
            targetType: 'Milestone',
            height: available_height,
            maxHeight: available_height,
            width: available_width,
            logger: this.logger,
            stateId: this.getContext().getScopedStateId('ts-ms-tree'),
            stateful: true,
            limitToInScopeFeatures: this.down('#limitToInScopeFeatures_cb') && this.down('#limitToInScopeFeatures_cb').getValue(),
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
                },
                columnschanged: function(tree) {
                    this.fireEvent('columnschanged',this,tree);
                }
            }
        };
        if ( this.targetFilter ) {
            tree_config.targetFilter = this.targetFilter;
        }
        this.tree = container.add(tree_config);
    },

    _getTree: function() {
        return this.tree;
    },
    //
    _getAvailableTreeHeight: function() {
        var body_height = this.getHeight() || Ext.getBody().getHeight() || 0;
        var available_height = body_height - 200;
        return Ext.max([200,available_height]);
    },
    _getAvailableTreeWidth: function() {
        var body_width = this.getWidth() || Ext.getBody().getWidth() || 0;
        var available_width = body_width - 20;
        return Ext.max([550,available_width]);
    },

    _getStandardColumnsByDataIndex: function() {
        var me = this;
        var name_renderer = function(value,meta_data,record) {
            return me._nameRenderer(value,meta_data,record);
        };

        var magic_renderer = function(field,value,meta_data,record){
            return me._magicRenderer(field,value,meta_data,record);
        }

        return {
            'ObjectID': {
                xtype: 'treecolumn',
                text: 'Item',
                draggable: false,
                dataIndex: 'ObjectID',
                itemId: 'tree_column',
                renderer: name_renderer,
                minWidth: 50,
                menuDisabled: true,
                otherFields: ['FormattedID','Name']
            },
            'LeafStoryCount': {
                text:'Leaf Story Count',
                dataIndex:'LeafStoryCount',
                menuDisabled: true,
                hidden: true,
                calculator: function(child_item,parent_item) {
                    var child_val = 0,
                        parent_val = 0;
                    if ( _.isFunction(child_item.get) ) {
                        child_val = child_item.get('LeafStoryCount') || 0;
                        parent_val = parent_item.get('LeafStoryCount') || 0;
                    } else {
                        child_val = child_item.LeafStoryCount || 0;
                        parent_val = parent_item.LeafStoryCount || 0;
                    }
                    return child_val + parent_val;
                }
            },
            'AcceptedLeafStoryCount': {
                text: 'Accepted Leaf Story Count',
                dataIndex: 'AcceptedLeafStoryCount',
                hidden: true,
                menuDisabled: true,
                calculator: function(child_item,parent_item) {
                    var child_val = 0,
                        parent_val = 0;
                    if ( _.isFunction(child_item.get) ) {
                        child_val = child_item.get('AcceptedLeafStoryCount') || 0;
                        parent_val = parent_item.get('AcceptedLeafStoryCount') || 0;
                    } else {
                        child_val = child_item.AcceptedLeafStoryCount || 0;
                        parent_val = parent_item.AcceptedLeafStoryCount || 0;
                    }
                    return child_val + parent_val;
                }
            },
            'PercentDoneByStoryCount':{
                text: 'Percent Done By Story Count',
                dataIndex: 'PercentDoneByStoryCount',
                menuDisabled: true,
                renderer: function(value,meta_data,record){
                    return me._magicRenderer({name:'PercentDoneByStoryCount'},value,meta_data,record) || "";
                },
                hidden: true,
                // use convert because it's not a rollup
                convert: function(value,item) {
                    var partial = 0;
                    var total = 0;
                    if ( _.isFunction(item.get) ) {
                        partial = item.get('AcceptedLeafStoryCount') || 0;
                        total = item.get('LeafStoryCount') || 0;
                    }
                    var result = 0;
                    if ( total !== 0 ) {
                        result = partial/total;
                    }
                    return Ext.Number.toFixed(result,2);
                }
            },
            'LeafStoryPlanEstimateTotal': {
                text:'Leaf Story Plan Estimate Total',
                dataIndex:'LeafStoryPlanEstimateTotal',
                menuDisabled: true,
                hidden: true,
                calculator: function(child_item,parent_item) {
                    var child_val = 0,
                        parent_val = 0;
                    if ( _.isFunction(child_item.get) ) {
                        child_val = child_item.get('LeafStoryPlanEstimateTotal') || 0;
                        parent_val = parent_item.get('LeafStoryPlanEstimateTotal') || 0;
                    } else {
                        child_val = child_item.LeafStoryPlanEstimateTotal || 0;
                        parent_val = parent_item.LeafStoryPlanEstimateTotal || 0;
                    }
                    return parent_val + child_val;
                }
            },
            'AcceptedLeafStoryPlanEstimateTotal': {
                text: 'Accepted Leaf Plan Estimate Total',
                dataIndex: 'AcceptedLeafStoryPlanEstimateTotal',
                hidden: true,
                menuDisabled: true,
                calculator: function(child_item,parent_item) {
                    var child_val = 0,
                        parent_val = 0;
                    if ( _.isFunction(child_item.get) ) {
                        child_val = child_item.get('AcceptedLeafStoryPlanEstimateTotal') || 0;
                        parent_val = parent_item.get('AcceptedLeafStoryPlanEstimateTotal') || 0;
                    } else {
                        child_val = child_item.AcceptedLeafStoryPlanEstimateTotal || 0;
                        parent_val = parent_item.AcceptedLeafStoryPlanEstimateTotal || 0;
                    }
                    return parent_val + child_val;
                }
            },
            'PercentDoneByStoryPlanEstimate': {
                text: 'Percent Done By Story Plan Estimate',
                dataIndex: 'PercentDoneByStoryPlanEstimate',
                menuDisabled: true,
                hidden: true,
                renderer: function(value,meta_data,record){
                    return me._magicRenderer({name:'PercentDoneByStoryPlanEstimate'},value,meta_data,record) || "";
                },
                // use convert because it's not a rollup
                convert: function(value,item) {
                    var partial = 0;
                    var total = 0;
                    if ( _.isFunction(item.get) ) {
                        partial = item.get('AcceptedLeafStoryPlanEstimateTotal') || 0;
                        total = item.get('LeafStoryPlanEstimateTotal') || 0;
                    } else {
                        partial = item.AcceptedLeafStoryPlanEstimateTotal || 0;
                        total = item.LeafStoryPlanEstimateTotal || 0;
                    }

                    var result = 0;
                    if ( total !== 0 ) {
                        result = partial/total;
                    }
                    return Ext.Number.toFixed(result,2);
                }
            },
            'ActualStartDate': {
                text:'Actual Start Date',
                dataIndex:'ActualStartDate',
                menuDisabled: true,
                hidden: true,
                renderer: function(value,meta_data,record){
                    return me._magicRenderer({name:'ActualStartDate'},value,meta_data,record) || "";
                },
                calculator: function(child_item,parent_item) {
                    // make the parent have the earliest start date that isn't null
                    var child_val = null,
                        parent_val = null;
                    if ( _.isFunction(child_item.get) ) {
                        child_val = child_item.get('ActualStartDate') || null;
                        parent_val = parent_item.get('ActualStartDate') || null;
                    } else {
                        child_val = child_item.ActualStartDate || null;
                        parent_val = parent_item.ActualStartDate || null;
                    }
                    if ( ! child_val ) {
                        return parent_val;
                    }
                    if ( ! parent_val ) {
                        return child_val;
                    }
                    if ( child_val < parent_val ) {
                        return child_val;
                    }
                    return parent_val;
                }
            }
        }
    },

    _getColumns: function() {
        var me = this;

        var name_renderer = function(value,meta_data,record) {
            return me._nameRenderer(value,meta_data,record);
        };

        var magic_renderer = function(field,value,meta_data,record){
            return me._magicRenderer(field,value,meta_data,record);
        }

        var fieldpicker = this.down('tsfieldpickerbutton');
        var blackListFields = ['FormattedID','_type'];
        var fieldpicker_fields = Ext.Array.map(fieldpicker && fieldpicker.getFields() || [], function(field){
            return { dataIndex: field, hidden: false };
        });

        var columns = this.saved_columns || fieldpicker_fields;
        columns = Ext.Array.push(['ObjectID'], columns);
        columns = Ext.Array.push(columns, fieldpicker_fields);// make sure we get them all

        var fields = [];
        var standard_fields = this._getStandardColumnsByDataIndex();

        var used_names = [];

        Ext.Array.each(columns, function(column) {
            if ( _.isString(column) ) {
                column = { dataIndex: column };
            }

            if ( Ext.Array.contains(blackListFields,column.dataIndex) || Ext.Array.contains(used_names,column.dataIndex)) {
                return;
            }
            used_names.push(column.dataIndex);

            var standard_config = standard_fields[column.dataIndex] || {};

            var field = null;
            Ext.Object.each(me.models, function(key,model){
                field = model.getField(column.dataIndex);
                if ( field ) { return false; }
            });
            if ( !field ) {
                console.log('cannot find field ', column.dataIndex);
                return;
            }

            var merged_config = {};
            if ( standard_fields[column.dataIndex] ) {
                merged_config = Ext.apply(standard_config,column);
            } else {
                var config = {
                    text:field.displayName.replace(/\(.*\)/,""),
                    dataIndex:field.name,
                    menuDisabled: true,
                    renderer:function(value,meta_data,record){
                        return me._magicRenderer(field,value,meta_data,record) || "";
                    },
                    sortable: true
                };

                if ( !field.sortable || column.dataIndex === "Discussion" ){
                    config.sortable = false;
                }
                merged_config = Ext.apply(config, column);
                // force Name to be the one that takes up the slack for fitting the grid
                if ( merged_config.dataIndex == 'Name' ) {
                    merged_config.flex = 1;
                }
            }
            fields.push(merged_config);
        });

        Ext.Object.each(standard_fields,function(name,config){
            if ( Ext.Array.contains(used_names,name) ) {
                return;
            }
            fields.push(config);
        });

        fields = Ext.Array.push([{
            xtype:'tsrowactioncolumn',
            dataIndex:'_type',
            text: ''
        }],fields);

        return fields;
    },

    _nameRenderer: function(value,meta_data,record) {
        if ( record.get('_type') == "milestone") {
            var display_value = record.get('Name');
            if ( record.get('FormattedID') ) {
                var link_text = record.get('FormattedID');
                var url = Rally.nav.Manager.getDetailUrl( record );
                display_value = "<a class='formatted-id-link' target='_top' href='" + url + "'>" + link_text + "</a>";
            }
            return display_value;
        }
        return this._magicRenderer({name:'FormattedID'},value,meta_data,record);
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
    },

    _getView: function() {
        var tree = this._getTree();
        if ( !tree ) {
            console.log('no tree');
            return null;
        }
        var grid = tree.getGrid();
        if ( ! grid ) {
            console.log('no grid');
            return null;
        }
        return grid.getView();
    },

    // takes an extjs view
    _getColumnsFromView: function(view) {
        var columns = view.getGridColumns();
        var savable_column_information = Ext.Array.map(columns, function(column){
            var column_information = {
                text: column.text,
                hidden: column.hidden
            };
            if ( column.width ) {
                column_information.width = column.width;
            } else if ( column.flex ) {
                column_information.flex = column.flex;
            }

            if ( column.dataIndex ) {
                column_information.dataIndex = column.dataIndex;
            }

            return column_information;
        });
        return savable_column_information;
    },

    setCurrentView: function(view) {
        // set field picker
        var field_list = [];
        Ext.Array.each(view.columns || [], function(column){
            if ( ! column.hidden ) {
                field_list.push(column.dataIndex);
            }
        });
        this.saved_columns = view.columns;
        this.down('tsfieldpickerbutton') && this.down('tsfieldpickerbutton').updateFields(field_list);

        //this.down('#filter_box').removeAll();
        this.down('#filter_container').removeAll();
        var default_state = {
            advancedCollapsed: false,
            advancedFilters: [],
            collapsed: false,
            condition: "",
            matchType: "AND",
            quickFilterFields: [],
            quickFilters: [],
            types: []
        };
        this.down('rallyinlinefilterbutton').applyState(view.filterState || default_state);
    },

    getCurrentView: function() {
        // todo: deal with when there's no grid
        var view = this._getView();
        if ( ! view ) {
            return {};
        }

        var columns = this._getColumnsFromView(view);

        var filtercontrol = this.down('rallyinlinefiltercontrol');
        var state = this.down('rallyinlinefilterbutton').getState();

        return {
            toggleState: "grid",
            columns: columns || [],
            filterState: state
        };
    },

    getState: function() {
        var state = this.getCurrentView();
        state.saved_columns = state.columns;
        this.saved_columns = state.saved_columns;
        return state;
    }
});
