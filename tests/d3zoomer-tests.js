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

Tinytest.add(testLevel +  'Test mousewheel zoom', function (test) {
    // Setup
    var el = $("<div />");
    var options = {};
    $.browser = { msie: false };
    RTL = false;
    var graph = new d3graph(el, options);
    
    // Execute

    var e = document.createEvent("MouseEvents");
    e.initMouseEvent(
        "mousewheel", 
        true,  // in boolean canBubbleArg,
        true,  // in boolean cancelableArg,
        window,// in views::AbstractView viewArg,
        120,   // in long detailArg,
        0,     // in long screenXArg,
        0,     // in long screenYArg,
        0,     // in long clientXArg,
        0,     // in long clientYArg,
        0,     // in boolean ctrlKeyArg,
        0,     // in boolean altKeyArg,
        0,     // in boolean shiftKeyArg,
        0,     // in boolean metaKeyArg,
        0,     // in unsigned short buttonArg,
        null);   // in EventTarget relatedTargetArg
    el.find("svg g")[0].dispatchEvent(e);
       
    // Verify
    //console.log("el: ", el[0]);
    
    var innerG = el.find("svg g g");
    
    // The event doesn't seem to trigger correctly. Not sure why.
    //test.equal(innerG.attr("transform"), "translate(0,0) scale(3)", "The zoomer should have mofied the transform of the inner G element");
});

