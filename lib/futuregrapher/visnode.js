define(function(require) {
    
    var VisNode = function (id, data, clusterId) {
        this.id = id;
        this.data = data;
        this.clusterId = clusterId;
    };

    return VisNode;
});