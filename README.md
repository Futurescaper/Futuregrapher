meteor-d3graph
==============

Meteorite package for D3 force-directed graphs

D3Graph
The d3graph library is a standalone Meteor package (installed with mrt add d3graph) that allows for easy creation and manipulation of a D3 force-directed graph.  It is a separate Git repository, available at https://github.com/Futurescaper/meteor-d3graph.  When changes are made to this project, the version number (in smart.json) must be incremented and the package must be released to Atmosphere via “mrt release .” - to update the package without incrementing its version, use “mrt publish .”

The package exists on Atmosphere at:
https://atmosphere.meteor.com/package/d3graph

Most likely this library will be open-sourced in the near future.
d3graph
The following is the logical flow that occurs when a graph is created:
The {{createGraph}} template helper is called
This renders the “graphSVG” template with the data for the graph stored as a session variable
In the Template.graphSVG.rendered() method, a d3graph object is created on an existing div element.
When the d3graph object is created, it renders an <svg> element inside of the specified element
Nodes and links are then added through methods on the d3graph object and any of its helper libraries.

Helper libraries are accessible from the d3graph object via:

var graph = new d3graph(el);
var nodesHelper = graph.d3nodes();
nodesHelper.addNode({ … })

Name
File
Description
d3nodes()
nodes.js
Adding and removing nodes.  Calculating node sizes and colors. Clustering nodes.  Calculating shortest paths.  Event handling for nodes.
d3links()
links.js
Adding and removing links.  Arrowheads.  Link geometry and colors.  Event handling for links.
d3labels()
labels.js
Label size, position and color.  Show only top x labels.  Event handling for labels.
d3highlights()
highlights.js
Fading, animating lines, highlighting sets of nodes, animating a single node radius, position, color.
d3styles()
styles.js
Holds visual settings and colors

To construct a graph, use the following:

<div id=”my-graph”></div>
var graph = new d3graph($(‘#my-graph’), { options });

Options are a set of optional parameters:

Name
Default
Description
maxLabels
7
The maximum number of labels to make visible.
constrainNodes
true
Whether to constrain nodes to be visible within the graph window
embedLabels
true
Whether to embed the labels inside of the nodes, or to the left/right side
minFontSize
8px
The minimum font size for labels
maxFontSize
16px
The maximum font size for labels
minMarkerSize
1.0
The minimum marker size (marker sizes needs work!)
maxMarkerSize
1.0
The maximum marker size
gravity
.03
The d3 gravity for the graph
friction
.9
The d3 friction for the graph
charge
-150
The d3 charge
linkStrength
.2
The strength of the links between nodes
minRadius
3
Smallest node radius
maxRadius
20
Largest node radius - node radii are calculated according to the ratio of their value (based on some particular filter) to the max value in the graph - the radius is then scaled accordingly between the minRadius and maxRadius values.
nodeBorderSize
0
The size of the node borders.
linkConstant
1


minLinkThickness
1.0
Minimum link thickness
maxLinkThickness
1.0
Maximum link thickness
highlightedLinkThickness
5
Link thickness multiplier when links are highlighted
linkRadiiFalloffPower
1


fixed
false
Whether or not the nodes are fixed or animating
zoom
false
Whether or not a zoom widget is displayed
initialZoom
1.0
The initial zoom level
reverseLabelPosition
false
Reverses the label positions - used for RTL languages.
tooltipDelay
100
The delay (in ms) before displaying node and link tooltips
nodeTooltipClass
‘tipsy-node’
The CSS class to apply for node tooltips
linkTooltipClass
‘tipsy-link’
The CSS class to apply for link tooltips
nodeBorderDarkening
.8
How much darker to make the node borders from the node fill color
linkMin
#80C8FF
Default min link color
linkMax
#203094
Default max link color
nodeMin
#FFC880
Default min node color
nodeMax
#943020
Default max node color
nodeSelected
#FF0000
Default node selection color

Event handlers are also specified through the options object during graph construction:

onGraphClick(event)
When any white space in the graph is clicked
string onNodeTooltip(node)
Callback function that returns a string that should be displayed as a tooltip when the node is hovered
string onLinkTooltip(link)
Callback function that returns a string that should be displayed as a tooltip when the link is hovered
onNodeClick(node)
When a node is clicked


onNodeRightClick(node)
When a node is right-clicked
onNodeDblClick(node)
When a node is double-clicked
onNodeMouseover(node)
When the mouse hovers over a node
onNodeMouseout(node)
When the mouse leaves a node
onLabelClick(label)
When a label is clicked
onLabelMouseover(label)
When the mouse hovers over a label
onLabelMouseout(label)
When the mouse stops hovering over a label

Some important d3graph methods:

Name
Description
clear()
Clears the graph completely of all nodes, links and labels
calculate()
Re-calculates the node and link values
update()
Re-draw the graph
stop()
Stops the graph forces
start()
Starts the graph forces

d3color

The d3color object represents a color and is used across the d3graph library.  It provides easy conversion between hex, rgba, and hsv color formats.  It can be easily constructed:

var myColor = new d3color(‘#aaccff’);		// can also use ‘aaccff’
var myColor = new d3color([170, 204, 255]);

and its value can be retrieved in the following ways:

var rgba = myColor.rgba();   		// returns [170,204,255,1]
var rgbastr = myColor.rgbastr(); 	// returns “rgb(170,204,255)”
var hex = myColor.hex();		// returns “aaccff”
var hsv = myColor.hsv();		// returns the hsv values

d3colors

This is a static helper object with a variety of color-related functions.  All methods are called via d3colors.<method name>:

Name
Return
Param
Type
Description
blend
d3color




Blends 2 colors together and returns the color at a certain ratio of the spectrum.




color1
d3color
The first color to blend




color2
d3color
The second color to blend




blend
float
A ratio between 0 and 1, where 0 would return color 1 and 1 would return color 2.
average
d3color




Finds the average color from a set of colors.




colors
List[d3color]
The list of colors to be averaged
darken
d3color




Darkens a specified color by a specified amount.




color
d3color
The color to be darkened




val
float
The value to darken the color by (0 = completely black and 1 = no change)
lighten
d3color




Lightens a specified color by a specified amount.




color
d3color
The color to be lightened




val
float
The value to lighten the color by (0 = no change and 1 = completely white)
spectrum
d3color




Returns a color at some ratio along a default spectrum




ratio
float
The color at this ratio along the spectrum will be returned

d3nodes

The d3nodes object may be retrieved from any d3graph by calling d3graph.d3nodes().  This object provides functionality for adding and removing nodes, calculating node sizes and colors, moving nodes, and finding shortest path and clusters in the node set.

A d3node has the following definition:
{
id: 		unique identifier for the node
title:		label text
x:		initial x-coordinate position
y:		initial y-coordinate position
index:		numeric positional index in the list of nodes
to[]:		list of outgoing links
from[]:		list of incoming links
tags[]:		list of associated tags
data[]:		list of associated data objects
quality:		associated Quality object
value:		numeric value used to determine color and size
filterValues:	cache of pre-calculated filter values
radius:		current node radius
centrality:	current node centrality value
visibility:	true/false
}

The d3nodes object has the following methods:

d3node addNode(nodeDefinition)
Adds a new node to the graph.

nodeDefinition = {
id: 		unique identifier for the node
title:		node label
weight:		node weight (defaults to 1)
data:		any associated data object
update:	whether or not to update the graph automatically after the node is added
quality:		the associated quality object
x:		initial x-position
y: 		initial y-position
radius: 	initial radius
centrality: 	current centrality value
}

animateNodeClick(d3node, callback())
Animates the node into a “selected” color with a 25% larger radius, and then back to its original color and radius, over 75ms, and then calls the callback function when it completes.

calculateNodes(string filterKey)
Re-calculates node values and radii based on the value for the filterKey that is specified.  If there are no values for this filter, then the nodes will be given a value of 0.  Note: the graph is not automatically updated after calculating, d3graph.update() must still be called to update the visual display.

d3node getNode(string id)
Returns a d3node with the specified id, or null if it doesn’t exist.

getShortestPath(node[] nodes, node from, node to)
Finds the shortest path between from and to using the collection of nodes specified.  Returns she shortest array of links that connect the two nodes together, if one exists, otherwise an empty array is returned.

moveNodes(positions[], time = 500, ignoreLinks = false)
This function will iterate through each position object and set various node properties, animated over a certain time (defaulting to .5 second).  If ignoreLinks is true, then all links are displayed, otherwise only links specified in the positions[] objects are visible.

position = {
	id: 		id of the node
	x:		node x position
	y:		node y position
	radius: 	node radius
	opacity:	node opacity
	color:		node color
	stroke:		node border color
	labelColor:	node label color
	labelSize:	node label font size
	labelOpacity:	node label opacity,
	links:		array of links that should be displayed
			link = { id: <link id>, opacity: <opacity>, color: <color>, width: <thickness> }
}

string removeNode(id, tag, fade, forceRemove)
Reduces the value of a node with the specified ID by 1.  If the node value becomes zero or less (or if forceRemove is true), then the node is removed from the graph.  If a tag is specified, then one instance of the specified tag is also removed from the node.  If successful, returns undefined, otherwise returns the error message.  Note: the fade parameter is no longer used and can be removed.

setNodeTitle(node, title, showFull = false)
Sets the node’s title.  If showFull is false, then the title is shortened to the first 8 words, otherwise the entire title text is displayed.

d3links
The d3links object may be retrieved from the graph via d3graph.d3links().  It is used internally for determining link geometry, size, and color, and externally for adding, removing and clearing links from the graph.

link addLink(linkSettings)
Adds a new link to the graph if it doesn’t already exist, otherwise increments the existing link’s weight.

linkSettings = {
	from: 		id of source node
	to:		id of target node
	weight:		link weight (defaults to 1)
	data:		any associated data for this link
	tag:		a tag to associate with this link
	type:		a numeric link type value
	update:		if true, updates the graph immediately after adding the link
}

string removeLink(from, to, tag, dontUpdate, forceRemove)
Decreases the specified link’s weight by one (from and to are the id’s of the source and target nodes), and if the weight is less than or equal to zero, or if forceRemove is true, then the link is permanently removed from the graph.  If a tag is specified, then one instance of the tag is also removed.  If successful, returns undefined, otherwise returns the error message.

clearLinks()
Removes all links from the graph and updates the display.

d3labels
This module is used internally to determine label text, color and position.  Externally it can be used to control how many labels are visible within a graph.

showTop(howMany, property)
Will retrieve the value of any property on each node (defaults to ‘value’), sort the nodes by that value, and then display the labels on the top howMany nodes.  Labels on all other nodes will be hidden.

d3highlights
This module is used to perform highlighting on subgraphs within the graph, animations of nodes and lines, and fading the graph in and out.

animate(node, settings)
Animates attributes of a node.

settings = {
time:		animation time in ms
radius:		node radius to animate to
color:		node color to animate to
x:		node x-position to animate to
y:		node y-position to animate to
moveToTop:	if the node should be placed top-most in the DOM
}

animateLine(x1, y1, x2, y2, color, time, thickness)
Animates a line from the specified (x1,y1) and (x2,y2) points, with the specified color and thickness, over the specified time.

displayNodes(options, time)
Shows only a subset of the graph nodes and links.

options = {
nodes:		single node, or array of nodes that should be highlighted
links:		‘all’, ‘node’, or ‘connected’
showLabels:	whether the node labels should be visible
opacity:	the opacity of the displayed links (BUG: rename to linkOpacity)
}

fadeIn(time)
Fades the entire graph visible, over a specified time (defaults to instantly).

fadeOut(opacity, time)
Fades the entire graph out to a specified opacity over a specified time (default to instantly).

d3styles can be merged into the rest of the modules and removed!

d3selector
This object is not part of the d3graph, but can be created and used alongside it.  A d3selector object can be used to toggle nodes from an unselected state to a selected state, and vice versa.  It provides methods for toggling a node selection, getting the selected nodes, refreshing the display of the selected nodes in the graph, and clearing the selection.  A d3selector object is associated with its accompanying d3graph upon construction:

var graph = new d3graph(...)
var selector = new d3selector(graph)

bool toggleNode(node)
Toggles the selection of a node from off to on and vice-versa.

bool isSelected(nodeId)
Returns true if the node with the specified id is currently selected.

int getCount()
Returns the number of selected nodes.

clear()
Clears all selections

refresh()
Re-colors all selected nodes appropriately (using the graph’s nodeSelectedColor setting).
