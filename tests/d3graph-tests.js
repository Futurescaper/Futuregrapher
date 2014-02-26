var testLevel = "meteor-d3graph tests - d3graph - ";

Tinytest.add(testLevel +  'constructor test', function (test) {
    // Setup
    var el = $("<div />");
    var options = {};

    $.browser = { msie: false };
    
    // Execute
    var graph = new d3graph(el, options);
    
    // Verify
});

