var testLevel = "meteor-d3graph tests - d3links - ";

Tinytest.add(testLevel + 'addLink', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var nodeLibStub = new NodeLibStub();
    nodeLibStub.stubNodes("fromNode", "toNode");
    
    var linklib = new d3links(d3graphStub, nodeLibStub);

    // Execute
    var linkSettings = {
        from: "fromNode",
        to: "toNode"
    }
    var addedLink = linklib.addLink(linkSettings);
    
    // Verify
    test.equal(linklib.getLinks().length, 1, "Linklib should contain exactly one link");
    test.equal(linklib.getLinks()[0].source.title, "fromNode", "Source node should be our 'fromNode'");
    test.equal(linklib.getLinks()[0].target.title, "toNode", "Target node should be our 'toNode'");
});

Tinytest.add(testLevel + "test updateMarkers", function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var el =  $("<div />");
    d3graphStub.markers = d3.select(el[0]).append("svg:svg").append("svg:defs");
    d3graphStub.d3styles = function () { return { colors: { linkMin: "blue", linkMax: "red" } }; }
    
    var nodeLibStub = new NodeLibStub();
    nodeLibStub.stubNodes("fromNode", "toNode");
    
    var linklib = new d3links(d3graphStub, nodeLibStub);
    var linkSettings = {
        from: "fromNode",
        to: "toNode"
    }
    var addedLink = linklib.addLink(linkSettings);

    // Execute
    linklib.updateMarkers();
    
    // Verify
    var nodeElements = el.find("marker");
    test.equal(nodeElements.length, 10, "There should be 10 markers when there is one link");
    
    console.log(el[0]);
});

