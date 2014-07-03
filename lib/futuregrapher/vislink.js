define(function(require) {

    var VisLink = function (sourceNodeId, targetNodeId, data) {
        this.sourceNodeId = sourceNodeId;
        this.targetNodeId = targetNodeId;
        this.data = data;
    };
    
    return VisLink;
});    
