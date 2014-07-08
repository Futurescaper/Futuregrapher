Futuregrapher
==============
Network visualization javascript library

This library combines a number of D3 and custom features into a dynamic graph visualization library. It allows you to work with collapsible clusters as a way of grouping nodes.


Meteor
------
The library works as a standalone Meteor package (installed with mrt add futuregrapher) that allows for easy creation and manipulation of a D3 force-directed graph.  It is a separate Git repository, available at https://github.com/Futurescaper/Futuregrapher.

The package exists on Atmosphere at:
https://atmosphere.meteor.com/package/d3graph

Usage
=====

Using Futuregrapher is done by creating an instance of the <code>GraphVis</code> class. The constructor for this takes two parameters: renderer and options. The renderer needs to be an instance of a renderer. At the time of writing, only one renderer exists, it's called <code>SvgRenderer</code>.


The minimalist setup looks like this:

    <div id="graph-vis-container"></div>

    $(function () {
        var svgRenderer = new SvgRenderer($("#graph-vis-container"), {});
        var graphVis = new GraphVis(svgRenderer, {});
    });

The renderer will create an svg element inside the graph-vis-container div. Nothing will show up, this is an empty graph. In order to show something, you need at least one node. To do this, you need to instantiate the class <code>VisNode</code>. This class, along with <code>VisLink</code> and <code>VisCluster</code> form the elements that you supply to your <code>GraphVis</code> instance to make something appear.

To add a node and show it, add the following two lines:

    var node = new VisNode("myNode");
    graphVis.update([node], [], []);

This will create a node with the id myNode. We then update the graph. The update function takes three arrays: <code>visNodes</code>, <code>visLinks</code> and <code>visClusters</code>. In this example, we just give it our node.

Now, the visualization is boring at this stage. We haven't told our GraphVis anything about what we want our nodes to look like, so it will create our node in a random position, with the default radius and color (10 and grey). We can change that, but first let's create another node and link between them.

	var node1 = new VisNode("node1");
	var node2 = new VisNode("node2");
	var link = new VisLink("node1", "node2");
	graphVis.update([node1, node2], [link], []);

This should create a graph consisting of two nodes connected by a link. Still bland looking, but at least it's a small graph. 

Customizing appearance
----------------------
Typically we will want to map visual properties of nodes, links and clusters to values in our data, either directly or through some transformation.

Say you have some data that looks like this:

	var people = [
		{ name: "John", vehicle: "car", age: 45 },
		{ name: "Lisa", vehicle: "car", age: 37 },
		{ name: "Alice", vehicle: "bike", age: 39 }
	];

You might want to visualize these people as nodes where the color represents the vehicle and the size (radius) represents the age. First we would have to create a VisNode for each person and attach the object somehow. Let's take a look at the VisNode constructor:

	VisNode = function (id, data, clusterId)

The first parameter, <code>id</code>, needs to be a unique identifier. The <code>data</code> parameter can be anything we want, it allows us to attach an object to the node. We will use this to attach our person object to the nodes. We will ignore the <code>clusterId</code> parameter for now.

Now, the <code>data</code> property works in conjunction with a *describer* function. The describer function for nodes should follow this pattern:

	function describeVisNode(visNode, radiusFactor) {

		// Figure out what the node should look like here..

		return {
			color: ...,
			radius: ...,
			opacity: ...,
			...
		}
	}

So the complete code to visualize our people structure would be like this:

	var people = [
		{ name: "John", vehicle: "car", age: 45 },
		{ name: "Lisa", vehicle: "car", age: 37 },
		{ name: "Alice", vehicle: "bike", age: 39 }
	];

	var vehicleColors = { car: "red", bike: "blue" };
	function describeVisNode(visNode, radiusFactor) {
		var color = vehicleColors[visNode.data.vehicle];
		var radius = visNode.data.age / 2;

		return {
			color: color,
			radius: radius
		};
	}

	var svgRenderer = new SvgRenderer($("#graph-vis-container"), {});
	var graphVis = new GraphVis(svgRenderer, { describeVisNode: describeVisNode });

	var visNodes = _.map(people, function (person) { return new VisNode(person.name, person); });

	graphVis.update(visNodes, [], []);

This should show us three dots on the screen now, two red ones and a blue one. They should have slightly different radii.


Nodes, Links and clusters
-------------------------
This library visualizes three types of data: nodes, links and clusters. The nodes are visualized as circles. A link indicates that two nodes are connected, and is represented by a line between the two circles.

Finally, there is a concept of clusters. Clusters are another way of indicating a relationship between a group of nodes. A node can belong to zero or one clusters. Clusters can be visualized as *collapsed* or *expanded*. Collapsed clusters are represented by a single circle. Expanded clusters show circles for all the member nodes, as well as a convex hull surrounding them to indicate the relationship.
If a VisNode has a clusterId, a corresponding VisCluster *must* exist.


Force
-----
It's all well and good with static nodes, but you will probably want to apply the nice D3 force. Doing that is rather simple. You call <code>GraphVis.startForce()</code>. This will start the physics simulation. It will cool down and eventually stop but you can keep it going using <code>GraphVis.resumeForce()</code>.
The dynamics settings can be set in the <code>options.forceParameters</code>, and they can be modified afterwards by calling <code>GraphVis.updateForceDynamics</code>. 


Events
------
In order to make the visualization interactive, you can attach event handlers. The default event handlers allow you to zoom and pan, and they allow you to expand or collapse clusters. You can customize this behavior by setting specific event handlers in the <code>options</code> parameter to the <code>GraphVis</code> constructor.



Reference
=========

GraphVis constructor
--------------------
<code>GraphVis(renderer, options)</code>

This is the constructor for the <code>GraphVis</code> class. The <code>renderer</code> parameter must be an instance of a renderer like <code>SvgRenderer</code>.


###Options
The <code>options</code> paramter is a plain JS object. If it is not supplied, or certain properties are undefined, default values will be used. The following options are allowed:


####General Settings
 * <code>enableZoom</code> - Enable zooming (*default: true*)
 * <code>enablePan</code> - Enable panning (*default: true*)
 * <code>enableForce</code> - Enable physics simulation (Note: you still need to call <code>startForce()</code> to start it) (*default: true*)
 * <code>forceParameters</code> - object containing the parameters to d3.force. Details below.
 * <code>enableCollisionDetection</code> - Prevent nodes from colliding when force is applied (*default: true*)
 * <code>enableClusterForce</code> - Add gravity to clusters in an attempt to keep clusters separate (*default: false*)
 * <code>zoomExtent</code> - Allowed zoom range. (*default: [0.25, 4]*)
 * <code>zoomDensityScale</code> - transformation applied to determine radii, font sizes etc.
 * <code>updateOnlyPositionsOnZoom</code> - set to false if you want your describer functions called when zooming (*default: true*)
 * <code>updateOnlyPositionsOnTick</code> - set to false if you want your describer functions called on force ticks (*default: true*)

The two last properties allow you to describe your graph to more detail. However, this will trigger an entire <code>update()</code> call every time the user zooms/pans or when the force ticks. If your graph is large, this will perform poorly.

The default value for <code>zoomDensityScale</code> is <code>d3.scale.linear().domain([0.25, 4]).range([0.5, 2])</code>. This means that when the user zooms out to 0.25, radii will be 0.5 times the value from the description. You can supply any function that takes a zoom factor and returns a radius factor. This is the factor that will be applied to the "density" of the visual elements, such as radii, font size, link thickness and so on. If you set <code>zoomDensityScale</code> to <code>function () { return 1; }</code>, the density will remain constant and zooming will only cause elements to move closer to each other or further apart.

The <code>forceParameters</code> property can have the following subproperties:

 * <code>linkDistance</code> - [force.linkDistance](https://github.com/mbostock/d3/wiki/Force-Layout#wiki-linkDistance) (*defaut: 20*)
 * <code>linkStrength</code> - [force.linkStrength](https://github.com/mbostock/d3/wiki/Force-Layout#wiki-linkStrength) (*default: 1*)
 * <code>friction</code> - [force.friction](https://github.com/mbostock/d3/wiki/Force-Layout#wiki-friction) (*default: 0.9*)
 * <code>charge</code> - [force.charge](https://github.com/mbostock/d3/wiki/Force-Layout#wiki-charge) (*default: -30*)
 * <code>chargeDistance</code> - [force.chargeDistance](https://github.com/mbostock/d3/wiki/Force-Layout#wiki-chargeDistance) (*default: Infinity*)
 * <code>theta</code> - [force.theta](https://github.com/mbostock/d3/wiki/Force-Layout#wiki-theta) (*default: 0.8*)
 * <code>gravity</code> - [force.gravity](https://github.com/mbostock/d3/wiki/Force-Layout#wiki-gravity) (*default: 0.1*)

####Event Handling
You can supply the following event handlers in <code>options</code>:

 * <code>onUpdatePreProcess</code> - called from update() before processing vis*-elements
 * <code>onUpdatePreRender</code> - called from update() before rendering
 * <code>onClick</code> - event handler for when the user clicks the graph
 * <code>onMouseDown</code> - event handler for when the user presses the mouse button
 * <code>onMouseUp</code> - event handler for when the user releases the mouse button
 * <code>onMouseMove</code> - event handler for when the user moves the mouse
 * <code>onNodeClick</code> - event handler for node clicks
 * <code>onNodeDoubleClick</code> - event handler for node double-clicks
 * <code>onNodeMouseOver</code> - event handler for hovering over a node
 * <code>onNodeMouseOut</code> - event handler for when the mouse leaves a node
 * <code>onNodeDragStart</code> - event handler for when the user starts dragging a node
 * <code>onNodeDrag</code> - event handler called when the user is dragging a node
 * <code>onNodeDragEnd</code> - event handler for when the user drops a node somewhere
 * <code>onClusterNodeClick</code> - event handler for clicks on cluster placeholder-nodes
 * <code>onClusterNodeDoubleClick</code> - event handler for doubleclick on placeholder-node (*default: expand cluster*)
 * <code>onClusterNodeMouseOver</code> - event handler for hovering placeholder-nodes
 * <code>onClusterNodeMouseOut</code> - event handler for leaving placeholder-nodes
 * <code>onClusterNodeDragStart</code> - event handler for when the user starts dragging a placeholder-node
 * <code>onClusterNodeDrag</code> - event handler for dragging placeholder-nodes
 * <code>onClusterNodeDragEnd</code> - event handler for when the user drops a placeholder-node
 * <code>onLinkClick</code> - event handler for link clicks
 * <code>onLinkDoubleClick</code> - event handler for link double-clicks
 * <code>onLinkMouseOver</code> - event handler for hovering over a link
 * <code>onLinkMouseOut</code> - event handler for when the mouse leaves a link
 * <code>onClusterClick</code> - event handler for when the user clicks on a cluster hull
 * <code>onClusterDoubleClick</code> - event handler for cluster hull doubleclick (*default: collapse cluster*)
 * <code>onClusterMouseOver</code> - event handler for hovering a cluster hull
 * <code>onClusterMouseOut</code> - event handler for leaving a cluster hull


####Visual element describing
The <code>options</code> object allows the following properties for describing visual elements (See the section below on describing visual elements):

 * <code>defaultNodeDescription</code> - default description to use for nodes
 * <code>describeVisNode</code> - describer function to use for nodes
 * <code>defaultLinkDescription</code> - default description for links
 * <code>describeVisLink</code> - describer function for links
 * <code>defaultCollapsedClusterDescription</code> - default description for collapsed clusters
 * <code>describeCollapsedCluster</code> - describer function for collapsed clusters
 * <code>defaultExpandedClusterDescription</code> - default description for expanded clusters
 * <code>describeExpandedCluster</code> - describer function for expanded clusters


GraphVis.unscaleCoords
----------------------
<code>GraphVis.unscaleCoords = function (screenCoords)</code>

This function takes a set of screen coordinates relative to the container div and scales them into the coordinate system of the visualisation. The argument <code>screenCoords</code> should be an array of coordinates <code>[x, y]</code>. The return value has the same format.
Use this is you want to position something under the mouse etc.


GraphVis.update
---------------
<code>GraphVis.update = function (newVisNodes, newVisLinks, newVisClusters, transitionDuration, updateType)</code>

The update function causes the entire graph to be updated.

If arguments are supplied for <code>newVisNodes</code>, <code>newVisLinks</code> and <code>newVisClusters</code>, these will be used. Otherwise, the ones supplied from the last <code>update()</code> call will be reused.
Specifically, <code>update</code> will turn <code>VisNode</code>'s into <code>NodeCircle</code>'s, <code>VisLink</code>'s into <code>LinkLine</code>'s and <code>VisCluster</code>'s into <code>ClusterHull</code>'s. However, clusters that have <code>isCollapsed</code> set to true will not create a cluster hull but rather a placeholder-node that represents the given cluster.

If no <code>transitionDuration</code> is specified, it defaults to 250 (ms). The <code>updateType</code> argument will be passed on to the <code>onUpdatePreProcess</code> and <code>onUpdatePreRender</code> eventhandlers, if they exist. If it's not set, it defaults to "update", but it might be called internally from <code>zoom</code> or <code>tick</code> in which case <code>updateType</code> will be set to "zoom" or "tick" respectively,


GraphVis.updatePositions
------------------------
<code>GraphVis.updatePositions = function (updateType)</code>

This function updates positions and density-properties of the graph (i.e. radii, widths of links, font size etc.).
The <code>updateType</code> argument will be passed on to the <code>onUpdatePreRender</code> eventhandlers, if it exists.


GraphVis.updateForceDynamics
----------------------------
<code>GraphVis.updateForceDynamics(newForceParameters)</code>

This function allows you to dynamically change the parameteres of the d3.force instance. The <code>newForceParameters</code> can contain one or multiple of the options in available in the <code>options.forceParameters</code> property in the <code>GraphVis</code> constructor. Only properties that are set will have an effect.

This function also updates the internal <code>options</code> variable so it will work even if you haven't yet called <code>GraphVis.startForce()</code>.


GraphVis.zoomPan
----------------
<code>GraphVis.zoomPan = function (scale, translate, transitionDuration)</code>

This function allows you to zoom/pan to a specific location.


VisNode constructor
-------------------
<code>VisNode = function (id, data, clusterId)</code>

This constructs a <code>VisNode</code>. They are what you feed to <code>GraphVis.update()</code>

The <code>id</code> parameter must be set to a unique identifier. If the model that you are representing nodes with has an ID already, it is recommended that you use this.

The <code>data</code> parameter can contain any object you want to attach to your node.

The <code>clusterId</code> parameter can be null or it can be the ID of a cluster. If set, a corresponding <code>VisCluster</code> with the same ID must exist and be supplied to <code>GraphVis.update</code>.


VisLink constructor
-------------------
<code>VisLink = funciotn (sourceNodeId, targetNodeId, data)</code>

This constructs a <code>VisLink</code>.

The <code>sourceNodeId</code> and <code>targetNodeId</code> must be ID's of <code>VisNode</code>'s supplied in the same update() call.

The <code>data</code> parameter is optional. Use it to attach custom data to your link.


VisCluster constructor
----------------------
<code>VisCluster = function (id, data, isCollapsed)</code>

This constructs a <code>VisCluster</code>.

The <code>id</code> parameter must be a unique identifier for the cluster. Any <code>VisNode</code> that belongs to a cluster must set its <code>clusterId</code> property to something that matches one of these.

The <code>data</code> property is optional. You can use it to attach additional data to the cluster.

The <code>isCollapsed</code> property defines whether the cluster is collapsed or not. When collapsed, the a single <code>NodeCircle</code> will be drawn in stead of all of the nodes inside the cluster. If it's not collapsed, all the nodes belonging to the cluster will be represented individually and a convex hull ("cluster hull") will be drawn around them to indicate their relationship.


SvgRenderer constructor
-----------------------
<code>SvgRenderer(containerElement, options)</code>

This is the constructor for the <code>SvgRenderer</code> class. The <code>containerElement</code> parameter should be a jQuery object of the DOM element where the graph should be rendered.

At the time of writing, the only option allowed in the <code>options</code> parameter is <code>layerIds</code>. This is an array of strings, indicating which layers the renderer should create. The order is significant, as the first layer will be first in the DOM and hence will be the "bottom" layer. The default setting for this property is <code>["clusters", "links", "nodes", "labels", "ui"]</code>. The first four of these must exist, the "ui" layer is added as a way to add UI-elements on top of the visualization.


SvgRenderer.getLayer
---------------------
<code>SvgRenderer.getLayer = function (name)</code>

This method returns the D3 selection of the layer specified. This means that if you have a layer called "ui", you can apply D3 selection actions on it like this: <code>svgRenderer.getLayer("ui").append("svg:g")</code>. 


SvgRenderer.update
------------------
<code>SvgRenderer.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration</code>

This function updates the DOM with visual elements. It uses D3 to map data to the DOM. The data supplied should be directly mappable. The only transformation applied is the scales and <code>radiusFactor</code>. Coordinates are transformed with the scales. Radii, link widths, font sizes and the like are multiplied with the radiusFactor before applied.

<code>update</code> will add, update and remove elements in order to make the DOM match the data supplied. If <code>transitionDuration</code> is specified, the transition will take that number of milliseconds. Otherwise, it will default to 250ms.


SvgRenderer.updatePositions
---------------------------
<code>SvgRenderer.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor)</code>

This function is an optimized version of <code>update</code> that doesn't add or remove elements, and only updates certain properties like positions and sizes. This function is typically used when zooming or in a force tick function.


SvgRenderer.containerElement
----------------------------
<code>SvgRenderer.containerElement = function ()</code>

This function returns the jQuery object passed in the constructor.


SvgRenderer.width
-----------------
<code>SvgRenderer.width = function ()</code>

Gets the width of the container element.


SvgRenderer.height
-----------------
<code>SvgRenderer.height = function ()</code>

Gets the height of the container element.


