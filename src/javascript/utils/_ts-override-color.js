Ext.override(Rally.util.HealthColorCalculator,{
    calculateHealthColorForPortfolioItemData: function(recordData, percentDoneFieldName) {
        var today = this._getToday();

        var config = {
            percentComplete: recordData[percentDoneFieldName],
            startDate: recordData.ActualStartDate || recordData.PlannedStartDate || today,
            asOfDate: today
        };

        if(recordData[percentDoneFieldName] === 1){
            config.endDate = recordData.ActualEndDate || recordData.PlannedEndDate || today;
        } else {
            config.endDate = recordData.PlannedEndDate || today;
        }

        if ( recordData._type == "milestone" && recordData.TargetDate ) {
            config.endDate = recordData.TargetDate;
        }

        config.inProgress = config.percentComplete > 0;

        return this.calculateHealthColor(config);
    }
});
