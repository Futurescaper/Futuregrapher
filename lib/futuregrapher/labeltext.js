// LabelText is the class used for rendering the labels for nodes. 
// They have coordinates (x, y) as well as offset coordinates. The force engine will update the raw coords, so the offset
// should speficy how far away from the node the label should be rendered.
// These are passed to a renderer in the update() and updatePositions calls. 

define(function(require) {
    var TypeChecker = require('futuregrapher/typechecker');

    var LabelText = function (id, data) {
        this.id = id.toString();
        this.data = data;
    };
    
    // These properties must be present for rendering
    LabelText.prototype.propertyTypes = [
        TypeChecker.string("id"),
        TypeChecker.object("data"),
        TypeChecker.string("text"),
        TypeChecker.number("x"), // Note: x and y are NOT scaled to screen space because they are manipulated by d3.force
        TypeChecker.number("y"), // Scaling takes place in SvgRenderer.update, which is why it takes the scales as parameters.
        TypeChecker.number("offsetX"),
        TypeChecker.number("offsetY"),
        TypeChecker.string("anchor"),   // This can be "start", "end" or "auto". If set to auto, the label will be adjusted to the centroid of the nodes.
        TypeChecker.nonNegativeNumber("fontSize"),
        TypeChecker.color("color"),
        TypeChecker.color("borderColor"),
        TypeChecker.nonNegativeNumber("opacity"),
        TypeChecker.string("hoverText"),
        TypeChecker.object("eventHandlers")
    ];
    
    LabelText.prototype.optionalPropertyTypes = [];
    
    LabelText.prototype.updateProperties = function (properties) {
        TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
        _.extend(this, properties);
    }

    return LabelText;
});

