
Tinytest.add('d3graph tests - links test - addLink', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    d3graphStub.stubNodes("fromNode", "toNode");
    var linklib = new d3links(d3graphStub);

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

