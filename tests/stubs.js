D3graphStub = function () {
    var _nodes = {};
    var _links = {};

    var _nodelib = {
        getNode: function (name) { return _nodes[name]; }
    };
    
    var linklib = {
    }; 


    // Interface
    this.d3nodes = function () { return _nodelib; }
    this.d3links = function () { return _linklib; }
    this.events = {};
    this.links = [];
    this.update = function() {};
    
    // Stub helpers
    this.stubNodes = function (/* node1Name, node2Name, .... */) {
        _(arguments).each(function (nodeName) {
            _nodes[nodeName] = { title: nodeName, to: [], from: [] };
        });
    }

};
