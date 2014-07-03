// NodeCircle is the class used for rendering nodes and cluster-representation "nodes".
// These are passed to a renderer in the update() and updatePositions calls. 

define(function(require) {
    var TypeChecker = require('futuregrapher/typechecker');

    var NodeCircle = function (id, visData) {
        this.id = id.toString();
        this.visData = visData;
    };

    // These properties must be present for rendering
    NodeCircle.prototype.propertyTypes = [
        TypeChecker.string("id"),
        TypeChecker.object("visData"),  // This field can contain a VisNode or a VisCluster.
        TypeChecker.number("x"), // Note: x and y are NOT scaled to screen space because they are manipulated by d3.force
        TypeChecker.number("y"), // Scaling takes place in SvgRenderer.update, which is why it takes the scales as parameters.
        TypeChecker.nonNegativeNumber("radius"),
        TypeChecker.color("color"),
        TypeChecker.color("borderColor"),
        TypeChecker.nonNegativeNumber("borderWidth"),
        TypeChecker.nonNegativeNumber("opacity"),
        TypeChecker.string("hoverText"),
        TypeChecker.boolean("fixed"),
        TypeChecker.object("eventHandlers")
    ];

    // These are added to nodes by d3.force, so we should allow them
    NodeCircle.prototype.optionalPropertyTypes = [
        TypeChecker.number("index"), 
        TypeChecker.number("px"), 
        TypeChecker.number("py"), 
        TypeChecker.number("weight")
    ];

    // Update certain properties on the NodeCircle. Type checking makes sure no unknown properties are added (if it's enabled)
    NodeCircle.prototype.updateProperties = function (properties) {
        TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
        _.extend(this, properties);
    }

    return NodeCircle;
});
