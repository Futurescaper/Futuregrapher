define(function(require) {

    // This describer simply returns interpolated values between the two nodes.
    // If a node is hovered, links that point to it will have markers.
    var defaultLinkDescriber = function (visLink, sourceNodeCircle, targetNodeCircle, radiusFactor) {
        return {
            width: (sourceNodeCircle.radius + targetNodeCircle.radius) / 10,
            color: d3.interpolateRgb(sourceNodeCircle.color, targetNodeCircle.color)(0.5),
            opacity: (sourceNodeCircle.opacity + targetNodeCircle.opacity) / 2,
        };
    };
    
    var defaultGraphVisOptions = {
        // General settings
        enableZoom: true,
        enablePan: true,
        enableForce: true,
        forceParameters: {
            linkDistance: 20,
            linkStrength: 1,
            friction: 0.9,
            charge: -30,
            chargeDistance: Infinity,
            theta: 0.8,
            gravity: 0.1
        },
        enableCollisionDetection: true,
        enableClusterForce: false,
        zoomExtent: [0.25, 4],
        zoomDensityScale: d3.scale.linear().domain([0.25, 4]).range([0.5, 2]),
        updateOnlyPositionsOnZoom: true,        // If false, a complete update() will take place during zoom. More flexible but slower.
        updateOnlyPositionsOnTick: true,        // Likewise, for force ticks.
    
        // Event handling
        onUpdatePreProcess: null,
        onUpdateAutoZoom: null,
        onUpdatePreRender: null,
        onClick: null,
        onNodeClick: null,
        onNodeDoubleClick: null,
        onNodeMouseOver: null,
        onNodeMouseOut: null,
        onNodeDragStart: null,
        onNodeDrag: null,
        onNodeDragEnd: null,
        onClusterNodeClick: null,
        onClusterNodeDoubleClick: null,     // If unset, will default to "expand cluster".
        onClusterNodeMouseOver: null,
        onClusterNodeMouseOut: null,
        onClusterNodeDragStart: null,
        onClusterNodeDrag: null,
        onClusterNodeDragEnd: null,
        onLinkClick: null,
        onLinkDoubleClick: null,
        onLinkMouseOver: null,
        onLinkMouseOut: null,
        onClusterClick: null,
        onClusterDoubleClick: null, // If unset, will default to "collapse cluster".
        onClusterMouseOver: null,
        onClusterMouseOut: null,
        
        // Visual element describing
        
        defaultNodeDescription: {
            radius: 10,
            color: "#888",
            borderColor: "#333",
            borderWidth: 2,
            opacity: 1,
            hoverText: null,
            label: null,
            fixed: false
        },
        describeVisNode: null,
    
        defaultLinkDescription: {
            width: 1,
            color: "#333",
            opacity: 1,
            marker: false,
            curvature: 0,
            dashPattern: null,
            hoverText: null
        },
        describeVisLink: defaultLinkDescriber,
    
        // Collapsed clusters become node circles
        defaultCollapsedClusterDescription: {
            radius: 20,
            color: "#aaa",
            borderColor: "#fff",
            borderWidth: 2,
            opacity: 1,
            hoverText: null,
            label: null,
            fixed: false
        },
        describeCollapsedCluster: null,
    
        // Expanded clusters become cluster hulls
        defaultExpandedClusterDescription: {
            color: "#a88",
            borderColor: null,
            opacity: 0.2,
            hoverText: null
        },
        describeExpandedCluster: null,
    
        defaultClusterLinkDescription: {
            width: 2,
            color: "#222",
            opacity: 1,
            marker: false,
            curvature: 0,
            dashPattern: null,
            hoverText: null
        },
        describeClusterLink: null
    };

    return defaultGraphVisOptions;
});
