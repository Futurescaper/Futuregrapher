var testLevel = "meteor-d3graph tests - d3graph - ";

Tinytest.add(testLevel +  'constructor test [integration]', function (test) {
    // Setup
    var el = $("<div />");
    var options = {};
    $.browser = { msie: false };
    RTL = false;
    
    // Execute
    var graph = new d3graph(el, options);
    
    // Verify
    test.ok();  // If we've reached this point, the test is considered succeeded.
});


Tinytest.add(testLevel + "add a node [integration]", function (test) {
    // Setup
    var el = $("<div />");
    var options = {};
    $.browser = { msie: false };
    RTL = false;
    var graph = new d3graph(el, options);
    
    // Execute
    graph.addNode({});
    
    // Verify
    var nodeElements = el.find("g.node");
    test.equal(nodeElements.length, 1, "There should be a g.node element representing our added node");
});

/*
Tinytest.add(testLevel + "two nodes and a link [integration]", function (test) {
    // Setup
    var el = $("<div />");
    var options = {};
    $.browser = { msie: false };
    RTL = false;
    var graph = new d3graph(el, options);
    
    // Execute
    graph.addNode({ id: "1" });
    graph.addNode({ id: "2" });
    
    graph.addLink({ from: "1", to: "2" });
    
    // Verify
    console.log("Element: ", el[0]);
    var nodeElements = el.find("g.node");
    test.equal(nodeElements.length, 2, "There should be two g.node elements");
});
*/
