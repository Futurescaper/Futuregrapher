// Usage: testProperties(test, visNode, { id: "node1", clusterId: "cluster1" }, "visNode was incorrect");
testProperties = function (test, actualObject, expectedValues, message) {
    for(var k in expectedValues) {
        if (!expectedValues.hasOwnProperty(k)) continue;
        
        test.equal(actualObject[k], expectedValues[k], message || ("Property " + k + " was incorrect"));
    }
}

// Usage: testArrayProperty(test, visNodes, "id", ["node1", "node2"], "id's were incorrect");
testArrayProperty = function (test, objectArray, propertyName, propertyValues, message) {
    var actualPropertyValues = _(_(objectArray).pluck(propertyName)).sort();
    var expectedPropertyValues = _(propertyValues).sort();    
    
    test.equal(actualPropertyValues, propertyValues, message || ("Mismatch for property " + propertyName + "."));
}

