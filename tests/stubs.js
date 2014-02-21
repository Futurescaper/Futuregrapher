D3graphStub = function () {
    var _nodes = {};
    var _links = {};

    // Interface
    this.settings = { minRadius: 5, maxRadius: 10 };
    this.events = {};
    this.links = [];
    this.update = function() {};
    this.getNode = function (name) { return _nodes[name]; };
    
    // Stub helpers
    this.stubNodes = function (/* node1Name, node2Name, .... */) {
        _(arguments).each(function (nodeName) {
            _nodes[nodeName] = { title: nodeName, to: [], from: [] };
        });
    }

};
