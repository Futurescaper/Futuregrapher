var testLevel = "meteor-d3graph tests - d3zoomer - ";

Tinytest.add(testLevel +  'Test transform() function', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    d3graphStub.trans = [0, 0];
    d3graphStub.scale = 1;
    d3graphStub.el = $("<div />");
    d3graphStub.options = { class: "" };
    
    d3graphStub.d3labels = function () { return { updateLabelSizesForZoom: function () {} }; };
    d3graphStub.updateSizesForZoom = function () {};
    
    var zoomer = new d3zoomer(d3graphStub, null);
    
    // Execute
    zoomer.transform(3, [10, 20]);
    
    // Verify
    var innerG = d3graphStub.el.find("svg g g");
    test.equal(innerG.attr("transform"), "translate(10,20) scale(3)", "The zoomer should have mofied the transform of the inner G element");
});




